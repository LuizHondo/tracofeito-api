import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../app.ts";
import { db } from "../../db.ts";
import { createRenewalCharges } from "../../jobs/renewals.ts";
import { fakePayments } from "../../providers/payment.fake.ts";
import { hashPassword } from "../auth/password.ts";
import { startSession } from "../auth/session.ts";
import { hasAccess } from "./access.ts";
import { warningFor } from "./mine.ts";
import { addMonths, confirmCharge, confirmRefund } from "./subscriptions.ts";

const payments = fakePayments();
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let base: string;
const clean = async () => {
	const owner = { email: { endsWith: "@subs.test" } };
	await db.course.deleteMany({ where: { owner } });
	await db.user.deleteMany({ where: owner });
};
const buyerInfo = { name: "Buyer", cpfCnpj: "11144477735" };

async function mkUser(name: string, role: "user" | "creator" | "admin") {
	const user = await db.user.create({
		data: {
			email: `${name}@subs.test`,
			username: `s_${name}`,
			passwordHash: await hashPassword("x"),
			role,
			emailVerified: true,
		},
	});
	let cookie = "";
	await startSession(
		{ cookie: (_n: string, v: string) => (cookie = `sid=${v}`) } as never,
		user.id,
	);
	const post = (courseId: string, path: string, body: unknown) =>
		fetch(`${base}/courses/${courseId}/${path}`, {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify(body),
		});
	return {
		user,
		cookie,
		call: post,
		buy: (courseId: string, body: unknown) =>
			fetch(`${base}/courses/${courseId}/purchase`, {
				method: "POST",
				headers: { cookie, "content-type": "application/json" },
				body: JSON.stringify(body),
			}),
	};
}

async function setup(name: string) {
	const owner = await mkUser(`${name}owner`, "creator");
	await db.creatorProfile.create({
		data: {
			userId: owner.user.id,
			accountId: "a",
			walletId: `w_${name}`,
			apiKey: "k",
		},
	});
	const course = await db.course.create({
		data: {
			ownerId: owner.user.id,
			title: "C",
			baseMonthlyCents: 10000,
			published: true,
		},
	});
	const year = await db.plan.create({
		data: { courseId: course.id, months: 12, discountPercent: 20 },
	});
	const life = await db.plan.create({
		data: { courseId: course.id, months: null, lifetimeCents: 90000 },
	});
	return {
		owner,
		course,
		year,
		life,
		buyer: await mkUser(`${name}buyer`, "user"),
	};
}

before(async () => {
	await clean();
	server = createApp(
		{ send: async () => {} },
		undefined,
		() => payments.provider,
	).listen(0);
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
	server.close();
	await clean();
	await db.$disconnect();
});

test("addMonths clamps the day", () => {
	assert.equal(
		addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString(),
		"2026-02-28T00:00:00.000Z",
	);
	assert.equal(
		addMonths(new Date("2026-11-15T00:00:00Z"), 3).toISOString(),
		"2027-02-15T00:00:00.000Z",
	);
});

test("purchase is blocked until the creator's payouts are enabled", async () => {
	const s = await setup("block");
	payments.fake.enabled = false;
	const res = await s.buyer.buy(s.course.id, {
		planId: s.year.id,
		buyer: buyerInfo,
	});
	assert.equal(res.status, 409);
	assert.equal(
		((await res.json()) as { error: string }).error,
		"payouts_not_enabled",
	);
	assert.equal(await db.charge.count({ where: { courseId: s.course.id } }), 0);
});

test("charge routes to the creator and grants access only once paid", async () => {
	const s = await setup("recurring");
	payments.fake.enabled = true;
	const res = await s.buyer.buy(s.course.id, {
		planId: s.year.id,
		buyer: buyerInfo,
	});
	assert.equal(res.status, 201);
	const body = (await res.json()) as { amountCents: number };
	assert.equal(body.amountCents, 96000); // R$100 x 12 x 0.8
	assert.deepEqual(payments.fake.charges.at(-1), {
		amountCents: 96000,
		walletId: "w_recurring",
	});

	const charge = await db.charge.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.equal(await hasAccess(s.buyer.user, s.course), false); // unpaid

	const paidAt = new Date("2026-11-01T12:00:00Z");
	assert.equal(await confirmCharge(charge.providerId, paidAt), true);
	const sub = await db.subscription.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.equal(sub.expiresAt?.toISOString(), "2027-11-01T12:00:00.000Z");
	assert.equal(await hasAccess(s.buyer.user, s.course), true);

	assert.equal(await confirmCharge(charge.providerId, paidAt), false); // duplicate event
	const again = await db.subscription.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.equal(again.expiresAt?.toISOString(), sub.expiresAt?.toISOString());

	assert.equal(
		(await s.buyer.buy(s.course.id, { planId: s.year.id, buyer: buyerInfo }))
			.status,
		409,
	); // renew instead
});

test("lifetime never expires and expired access is denied at once", async () => {
	const s = await setup("lifetime");
	payments.fake.enabled = true;
	await s.buyer.buy(s.course.id, { planId: s.life.id, buyer: buyerInfo });
	const charge = await db.charge.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.equal(charge.amountCents, 90000);
	await confirmCharge(charge.providerId);
	const sub = await db.subscription.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.equal(sub.expiresAt, null);
	assert.equal(await hasAccess(s.buyer.user, s.course), true);

	await db.subscription.update({
		where: { id: sub.id },
		data: { expiresAt: new Date(Date.now() - 1000) },
	});
	assert.equal(await hasAccess(s.buyer.user, s.course), false);
});

test("unpublished course, bad plan and bad coupon are rejected", async () => {
	const s = await setup("bad");
	payments.fake.enabled = true;
	assert.equal(
		(
			await s.buyer.buy(s.course.id, {
				planId: crypto.randomUUID(),
				buyer: buyerInfo,
			})
		).status,
		404,
	);
	assert.equal(
		(
			await s.buyer.buy(s.course.id, {
				planId: s.year.id,
				couponCode: "NOPE",
				buyer: buyerInfo,
			})
		).status,
		400,
	);
	await db.course.update({
		where: { id: s.course.id },
		data: { published: false },
	});
	assert.equal(
		(await s.buyer.buy(s.course.id, { planId: s.year.id, buyer: buyerInfo }))
			.status,
		404,
	);
});

test("webhook confirms once; the same event or charge again changes nothing", async () => {
	const s = await setup("hook");
	payments.fake.enabled = true;
	await s.buyer.buy(s.course.id, { planId: s.year.id, buyer: buyerInfo });
	const charge = await db.charge.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	const hook = (body: unknown) =>
		fetch(`${base}/webhooks/payments`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
	const event = { eventId: `evt_${Date.now()}`, chargeId: charge.providerId };

	assert.equal((await hook({})).status, 400);
	assert.equal((await hook(event)).status, 204);
	const first = await db.subscription.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.ok(first.expiresAt);

	assert.equal((await hook(event)).status, 204); // redelivery
	assert.equal(
		(await hook({ ...event, eventId: `${event.eventId}b` })).status,
		204,
	); // new event, same charge
	const after = await db.subscription.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.equal(after.expiresAt?.toISOString(), first.expiresAt?.toISOString());
	assert.equal(
		await db.providerEvent.count({
			where: { id: { startsWith: event.eventId } },
		}),
		2,
	);
});

async function subscribed(name: string) {
	const s = await setup(name);
	payments.fake.enabled = true;
	await s.buyer.buy(s.course.id, { planId: s.year.id, buyer: buyerInfo });
	const first = await db.charge.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	await confirmCharge(first.providerId, new Date("2026-11-01T12:00:00Z"));
	const renew = (body: unknown = { buyer: buyerInfo }) =>
		s.buyer.call(s.course.id, "renew", body);
	return { ...s, renew };
}

test("renewal: current plan price, one pending charge per cycle, extends from old or now", async () => {
	const s = await subscribed("renew");
	// plan price changed since the purchase
	await db.course.update({
		where: { id: s.course.id },
		data: { baseMonthlyCents: 20000 },
	});

	const res = await s.renew();
	assert.equal(res.status, 201);
	const body = (await res.json()) as { chargeId: string; amountCents: number };
	assert.equal(body.amountCents, 192000); // R$200 x 12 x 0.8

	const again = (await (await s.renew()).json()) as { chargeId: string };
	assert.equal(again.chargeId, body.chargeId); // reused, not duplicated
	assert.equal(
		await db.charge.count({
			where: { courseId: s.course.id, status: "pending" },
		}),
		1,
	);

	const renewal = await db.charge.findUniqueOrThrow({
		where: { id: body.chargeId },
	});
	// paid 3 days before expiry: old date + 12 months
	await confirmCharge(renewal.providerId, new Date("2027-10-29T12:00:00Z"));
	const sub = await db.subscription.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.equal(sub.expiresAt?.toISOString(), "2028-11-01T12:00:00.000Z");

	// next cycle, paid after expiry: now + 12 months
	const next = (await (await s.renew()).json()) as { chargeId: string };
	const c2 = await db.charge.findUniqueOrThrow({
		where: { id: next.chargeId },
	});
	assert.notEqual(next.chargeId, body.chargeId);
	await confirmCharge(c2.providerId, new Date("2029-02-10T00:00:00Z"));
	const late = await db.subscription.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.equal(late.expiresAt?.toISOString(), "2030-02-10T00:00:00.000Z");
});

test("renewal needs a recurring subscription and enabled payouts", async () => {
	const s = await setup("norenew");
	assert.equal(
		(await s.buyer.call(s.course.id, "renew", { buyer: buyerInfo })).status,
		404,
	); // none yet
	payments.fake.enabled = true;
	await s.buyer.buy(s.course.id, { planId: s.life.id, buyer: buyerInfo });
	const c = await db.charge.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	await confirmCharge(c.providerId);
	assert.equal(
		(await s.buyer.call(s.course.id, "renew", { buyer: buyerInfo })).status,
		409,
	); // lifetime
});

test("renewal job charges and emails once per cycle, skipping canceled and out-of-window", async () => {
	const s = await subscribed("job"); // expires 2027-11-01T12:00Z
	const sent: { to: string; text: string }[] = [];
	const mailer = {
		send: async (e: { to: string; text: string }) => void sent.push(e),
	};
	const mine = () => sent.filter((e) => e.to === s.buyer.user.email);
	const pending = () =>
		db.charge.count({ where: { courseId: s.course.id, status: "pending" } });

	await createRenewalCharges(
		payments.provider,
		mailer,
		new Date("2027-10-20T00:00:00Z"),
	); // 12 days out
	assert.equal(mine().length, 0);

	const week = new Date("2027-10-28T00:00:00Z"); // 4 days out
	await createRenewalCharges(payments.provider, mailer, week);
	assert.equal(mine().length, 1);
	assert.match(mine()[0].text, /Pague para renovar: u/);
	assert.equal(await pending(), 1);
	const charge = await db.charge.findFirstOrThrow({
		where: { courseId: s.course.id, status: "pending" },
	});
	assert.equal(charge.amountCents, 96000);

	// the job runs on a simulated 2027 clock: keep this charge from looking stale
	await db.charge.updateMany({
		where: { courseId: s.course.id },
		data: { dueAt: new Date("2030-01-01") },
	});
	await createRenewalCharges(payments.provider, mailer, week); // same cycle again
	assert.equal(mine().length, 1);
	assert.equal(await pending(), 1);

	// a charge the user already opened by clicking renew is not duplicated either
	const other = await subscribed("job2");
	assert.equal((await other.renew()).status, 201);
	await createRenewalCharges(payments.provider, mailer, week);
	assert.equal(
		await db.charge.count({
			where: { courseId: other.course.id, status: "pending" },
		}),
		1,
	);

	// canceled renewals get no charge
	const canceled = await subscribed("job3");
	await db.subscription.updateMany({
		where: { courseId: canceled.course.id },
		data: { canceledAt: new Date() },
	});
	await createRenewalCharges(payments.provider, mailer, week);
	assert.equal(
		await db.charge.count({
			where: { courseId: canceled.course.id, status: "pending" },
		}),
		0,
	);
});

test("self-service: list with history and warning, cancel stops renewals but keeps access", async () => {
	const s = await subscribed("mine");
	const stranger = await mkUser("minestranger", "user");
	const list = async (u: typeof s.buyer) =>
		(
			await fetch(`${base}/subscriptions`, { headers: { cookie: u.cookie } })
		).json() as Promise<
			{
				id: string;
				canceledAt: string | null;
				warning: string | null;
				charges: { status: string; amountCents: number }[];
			}[]
		>;

	const mine = await list(s.buyer);
	assert.equal(mine.length, 1);
	assert.deepEqual(
		mine[0].charges.map((c) => [c.status, c.amountCents]),
		[["paid", 96000]],
	);
	assert.equal((await list(stranger)).length, 0);

	const cancel = (u: typeof s.buyer) =>
		fetch(`${base}/subscriptions/${mine[0].id}/cancel`, {
			method: "POST",
			headers: { cookie: u.cookie },
		});
	assert.equal((await cancel(stranger)).status, 404); // not theirs
	assert.equal((await cancel(s.buyer)).status, 204);
	assert.ok((await list(s.buyer))[0].canceledAt);
	assert.equal(await hasAccess(s.buyer.user, s.course), true);
	await createRenewalCharges(
		payments.provider,
		{ send: async () => {} },
		new Date("2027-10-28T00:00:00Z"),
	);
	assert.equal(
		await db.charge.count({
			where: { courseId: s.course.id, status: "pending" },
		}),
		0,
	);
});

test("warning: none far out, expiring within 7 days, expired after", () => {
	const now = new Date("2026-11-01T00:00:00Z");
	assert.equal(warningFor(null, now), null);
	assert.equal(warningFor(new Date("2026-12-01T00:00:00Z"), now), null);
	assert.equal(warningFor(new Date("2026-11-05T00:00:00Z"), now), "expiring");
	assert.equal(warningFor(new Date("2026-10-31T00:00:00Z"), now), "expired");
});

// Charge created straight in the DB and paid at `at`, as the webhook would.
let seq = 0;
async function paidCharge(
	s: {
		buyer: { user: { id: string } };
		course: { id: string };
		year: { id: string };
	},
	months: number | null,
	at: Date,
) {
	const providerId = `pay_t${Date.now()}_${seq++}`;
	await db.charge.create({
		data: {
			userId: s.buyer.user.id,
			courseId: s.course.id,
			planId: s.year.id,
			amountCents: 1000,
			months,
			providerId,
			dueAt: at,
		},
	});
	await confirmCharge(providerId, at);
	return providerId;
}
const expiry = async (courseId: string) =>
	(
		await db.subscription.findFirst({ where: { courseId } })
	)?.expiresAt?.toISOString();

test("refund rolls back the months the charge granted", async () => {
	const s = await setup("rb");
	const now = new Date();
	const first = await paidCharge(s, 12, now);
	const renewal = await paidCharge(s, 3, now);
	assert.equal(await expiry(s.course.id), addMonths(now, 15).toISOString());

	// latest renewal refunded: still in the future, access continues
	await confirmRefund(renewal, now);
	assert.equal(await expiry(s.course.id), addMonths(now, 12).toISOString());
	assert.equal(await hasAccess(s.buyer.user, s.course), true);

	// only remaining charge refunded: access ends at once
	await confirmRefund(first, now);
	assert.equal(await hasAccess(s.buyer.user, s.course), false);

	// charges stay as history
	const statuses = (
		await db.charge.findMany({ where: { courseId: s.course.id } })
	).map((c) => c.status);
	assert.deepEqual(statuses, ["refunded", "refunded"]);
});

test("refunded lifetime removes the subscription; duplicate refund event applies once", async () => {
	const s = await setup("rl");
	const life = await paidCharge(s, null, new Date());
	assert.equal(await hasAccess(s.buyer.user, s.course), true);
	await confirmRefund(life, new Date());
	assert.equal(
		await db.subscription.count({ where: { courseId: s.course.id } }),
		0,
	);
	assert.equal(await hasAccess(s.buyer.user, s.course), false);
	assert.equal(await db.charge.count({ where: { courseId: s.course.id } }), 1);

	const s2 = await setup("rd");
	const now = new Date();
	await paidCharge(s2, 12, now);
	const renewal = await paidCharge(s2, 3, now);
	const hook = () =>
		fetch(`${base}/webhooks/payments`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				eventId: `evt_r${renewal}`,
				chargeId: renewal,
				type: "refunded",
			}),
		});
	assert.equal((await hook()).status, 204);
	assert.equal((await hook()).status, 204);
	assert.equal(await expiry(s2.course.id), addMonths(now, 12).toISOString()); // rolled back once
});

test("refund endpoint: own sales for creators, any for admins, provider asked", async () => {
	const s = await setup("re");
	const other = await mkUser("reother", "creator");
	const admin = await mkUser("readmin", "admin");
	const providerId = await paidCharge(s, 12, new Date());
	const charge = await db.charge.findFirstOrThrow({ where: { providerId } });
	const refund = (u: { cookie: string }, id = charge.id) =>
		fetch(`${base}/charges/${id}/refund`, {
			method: "POST",
			headers: { cookie: u.cookie },
		});

	assert.equal((await refund(other)).status, 403); // another creator's sale
	assert.equal((await refund(s.buyer)).status, 403);
	assert.equal((await refund(s.owner)).status, 202);
	assert.equal((await refund(admin)).status, 202);
	assert.deepEqual(
		payments.fake.refunded.filter((id) => id === providerId),
		[providerId, providerId],
	);
	assert.equal((await refund(s.owner, crypto.randomUUID())).status, 404);

	payments.fake.fail = true; // e.g. boleto cannot be refunded
	assert.equal((await refund(s.owner)).status, 502);
	payments.fake.fail = false;

	await confirmRefund(providerId);
	assert.equal((await refund(s.owner)).status, 409); // already refunded
});

test("dashboard: income with refunds and net, subscribers, isolated per creator", async () => {
	const s = await setup("dash");
	const rival = await mkUser("dashrival", "creator");
	const get = (u: { cookie: string }, path: string) =>
		fetch(`${base}/dashboard/${path}`, { headers: { cookie: u.cookie } }).then(
			(r) => r.json(),
		) as Promise<any>;

	await db.page.create({
		data: { courseId: s.course.id, title: "P1", slug: "p1", position: 0 },
	});
	payments.fake.enabled = true;
	await s.buyer.buy(s.course.id, { planId: s.year.id, buyer: buyerInfo });
	const charge = await db.charge.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	await fetch(`${base}/webhooks/payments`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			eventId: `evt_d${charge.id}`,
			chargeId: charge.providerId,
			netCents: 94000,
		}),
	});

	let income = await get(s.owner, `income?courseId=${s.course.id}`);
	assert.equal(income.salesCount, 1);
	assert.equal(income.salesCents, 96000);
	assert.equal(income.receivedCents, 94000);
	assert.equal(income.refundsCount, 0);

	const subs = await get(s.owner, "subscribers");
	assert.equal(subs.length, 1);
	assert.equal(subs[0].user.email, s.buyer.user.email);
	assert.equal(subs[0].percent, 0);
	assert.deepEqual(await get(rival, "subscribers"), []); // other creator's buyer is invisible
	assert.equal((await get(rival, "income")).salesCount, 0);

	await confirmRefund(charge.providerId);
	income = await get(s.owner, "income");
	assert.equal(income.refundsCount, 1);
	assert.equal(income.refundsCents, 96000);
	assert.equal(income.receivedCents, 0);
	assert.equal(income.charges[0].status, "refunded");
	assert.equal((await get(s.owner, `income?from=2999-01-01`)).salesCount, 0); // period filter
	const refused = await fetch(`${base}/dashboard/income`, {
		headers: { cookie: s.buyer.cookie },
	});
	assert.equal(refused.status, 403); // plain users have no dashboard
});

test("an unpaid charge past its due date expires, a new cycle can start, and a late payment still counts", async () => {
	const s = await subscribed("stale");
	const first = (await (await s.renew()).json()) as { chargeId: string };
	await db.charge.update({
		where: { id: first.chargeId },
		data: { dueAt: new Date(Date.now() - 1000) },
	});

	const second = (await (await s.renew()).json()) as { chargeId: string };
	assert.notEqual(second.chargeId, first.chargeId); // not the dead link
	const old = await db.charge.findUniqueOrThrow({
		where: { id: first.chargeId },
	});
	assert.equal(old.status, "expired");
	assert.equal(
		await db.charge.count({
			where: { courseId: s.course.id, status: "pending" },
		}),
		1,
	);

	// the old boleto gets paid late: access is extended once
	const before = await db.subscription.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.equal(
		await confirmCharge(old.providerId, new Date("2027-10-29T00:00:00Z")),
		true,
	);
	const after = await db.subscription.findFirstOrThrow({
		where: { courseId: s.course.id },
	});
	assert.ok(
		after.expiresAt && before.expiresAt && after.expiresAt > before.expiresAt,
	);
	assert.equal(await confirmCharge(old.providerId), false);
});

test("renewal job opens a new charge when the previous one went stale", async () => {
	const s = await subscribed("stalejob");
	const stale = (await (await s.renew()).json()) as { chargeId: string };
	await db.charge.update({
		where: { id: stale.chargeId },
		data: { dueAt: new Date(Date.now() - 1000) },
	});
	const sent: { to: string }[] = [];
	await createRenewalCharges(
		payments.provider,
		{ send: async (e) => void sent.push(e) },
		new Date("2027-10-28T00:00:00Z"),
	);
	assert.equal(sent.filter((e) => e.to === s.buyer.user.email).length, 1);
	assert.equal(
		await db.charge.count({
			where: { courseId: s.course.id, status: "pending" },
		}),
		1,
	);
});
