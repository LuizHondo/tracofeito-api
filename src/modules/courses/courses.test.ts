import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../app.ts";
import { db } from "../../db.ts";
import { hashPassword } from "../auth/password.ts";
import { startSession } from "../auth/session.ts";

let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let base: string;
const clean = async () => {
	const owner = { email: { endsWith: "@courses.test" } };
	await db.course.deleteMany({ where: { owner } });
	await db.user.deleteMany({ where: owner });
};

async function login(name: string, role: "user" | "creator" | "admin") {
	const user = await db.user.create({
		data: {
			email: `${name}@courses.test`,
			username: `c_${name}`,
			bio: `bio of ${name}`,
			passwordHash: await hashPassword("x"),
			role,
			emailVerified: true,
		},
	});
	if (role !== "user")
		await db.creatorProfile.create({
			data: { userId: user.id, accountId: "a", walletId: "w", apiKey: "k" },
		});
	let cookie = "";
	await startSession(
		{
			cookie: (_n: string, v: string) => {
				cookie = `sid=${v}`;
			},
		} as never,
		user.id,
	);
	return (method: string, path: string, body?: unknown) =>
		fetch(base + path, {
			method,
			headers: { cookie, "content-type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
}

before(async () => {
	await clean();
	server = createApp({ send: async () => {} }).listen(0);
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
	server.close();
	await clean();
	await db.$disconnect();
});

test("course CRUD is limited to the owner; admin can manage and delete any", async () => {
	const a = await login("a", "creator");
	const b = await login("b", "creator");
	const admin = await login("admin", "admin");
	const user = await login("u", "user");
	const draft = { title: "T", baseMonthlyCents: 10000 };

	assert.equal((await user("POST", "/courses", draft)).status, 403);
	const created = await a("POST", "/courses", draft);
	assert.equal(created.status, 201);
	const course = (await created.json()) as {
		id: string;
		owner: { bio: string };
	};
	assert.equal(course.owner.bio, "bio of a"); // creator bio shows on course data

	assert.equal(
		(await b("PATCH", `/courses/${course.id}`, { title: "X" })).status,
		403,
	);
	assert.equal((await b("GET", `/courses/${course.id}`)).status, 403);
	assert.equal(
		(await a("PATCH", `/courses/${course.id}`, { title: "Y" })).status,
		200,
	);
	assert.equal(
		(await a("PATCH", `/courses/${course.id}`, { featured: true })).status,
		400,
	);
	assert.equal(
		(await admin("PATCH", `/courses/${course.id}`, { published: true })).status,
		200,
	);

	await a("PATCH", "/auth/me", { bio: "new bio" });
	await a("POST", `/courses/${course.id}/plans`, { months: 1 });
	await a("POST", `/courses/${course.id}/pages`, { title: "L1", slug: "l1" });
	await a("POST", `/courses/${course.id}/blocks`, {
		type: "title",
		config: { text: "Oi" },
	});
	const mine = (await (await a("GET", "/courses/mine")).json()) as {
		owner: { bio: string };
		_count: { plans: number; pages: number; blocks: number };
	}[];
	assert.equal(mine[0]?.owner.bio, "new bio");
	assert.deepEqual(mine[0]?._count, { plans: 1, pages: 1, blocks: 1 });
	const other = await b("GET", "/courses/mine");
	assert.deepEqual(await other.json(), []);

	assert.equal((await a("DELETE", `/courses/${course.id}`)).status, 403);
	assert.equal((await admin("DELETE", `/courses/${course.id}`)).status, 204);
	assert.equal((await a("GET", `/courses/${course.id}`)).status, 404);
});

test("plans: length 1-12 or lifetime, one per length, discount defaults to 0", async () => {
	const a = await login("pa", "creator");
	const b = await login("pb", "creator");
	const { id } = (await (
		await a("POST", "/courses", { title: "P", baseMonthlyCents: 10000 })
	).json()) as { id: string };
	const plans = `/courses/${id}/plans`;

	const five = await a("POST", plans, { months: 5 });
	assert.equal(five.status, 201);
	assert.equal(
		((await five.json()) as { discountPercent: number }).discountPercent,
		0,
	);
	for (const months of [0, 13, 2.5])
		assert.equal((await a("POST", plans, { months })).status, 400);
	assert.equal((await a("POST", plans, { months: 5 })).status, 409);

	assert.equal((await a("POST", plans, { months: null })).status, 400); // lifetime needs a price
	assert.equal(
		(await a("POST", plans, { months: null, lifetimeCents: 90000 })).status,
		201,
	);
	assert.equal(
		(await a("POST", plans, { months: null, lifetimeCents: 80000 })).status,
		409,
	);

	assert.equal((await b("POST", plans, { months: 3 })).status, 403);
	const list = (await (await a("GET", plans)).json()) as {
		id: string;
		months: number | null;
	}[];
	const rec = list.find((p) => p.months === 5);
	assert.equal(
		(await a("PATCH", `${plans}/${rec?.id}`, { discountPercent: 20 })).status,
		200,
	);
	assert.equal(
		(await a("PATCH", `${plans}/${rec?.id}`, { lifetimeCents: 5 })).status,
		400,
	);
});

test("coupons: value parsing, active-code uniqueness, cancel, expiry; quote clamps", async () => {
	const { quote } = await import("../coupons/coupons.ts");
	const a = await login("ca", "creator");
	const b = await login("cb", "creator");
	const { id } = (await (
		await a("POST", "/courses", { title: "C", baseMonthlyCents: 10000 })
	).json()) as { id: string };
	const plan = (await (
		await a("POST", `/courses/${id}/plans`, { months: 12, discountPercent: 20 })
	).json()) as { id: string };
	const url = `/courses/${id}/coupons`;
	const tomorrow = new Date(Date.now() + 86400000).toISOString();
	const mk = (value: string, code = "PROMO", expiresAt = tomorrow) =>
		a("POST", url, { code, value, expiresAt });

	for (const v of ["0%", "150%", "-5", "abc"])
		assert.equal((await mk(v)).status, 400);
	const first = (await (await mk("30%")).json()) as {
		id: string;
		type: string;
		value: string;
	};
	assert.equal(first.type, "percent");
	assert.equal(Number(first.value), 30);
	assert.equal((await mk("10", "promo")).status, 409);
	assert.equal((await b("POST", url, {})).status, 403);

	assert.deepEqual(await quote(id, plan.id), {
		amountCents: 96000,
		planCents: 96000,
	});
	assert.deepEqual(await quote(id, plan.id, " promo "), {
		amountCents: 67200,
		planCents: 96000,
		couponId: first.id,
	});

	assert.equal((await a("POST", `${url}/${first.id}/cancel`)).status, 204);
	assert.equal(await quote(id, plan.id, "PROMO"), "invalid_coupon");
	const fixed = await mk("30"); // reuse after cancel
	assert.equal(fixed.status, 201);
	assert.equal(((await fixed.json()) as { type: string }).type, "fixed");

	const big = (await (await mk("5000", "BIG")).json()) as { id: string };
	const clamped = await quote(id, plan.id, "BIG");
	assert.ok(typeof clamped === "object" && clamped.amountCents === 500);

	await db.coupon.update({
		where: { id: big.id },
		data: { expiresAt: new Date(Date.now() - 1000) },
	});
	assert.equal(await quote(id, plan.id, "BIG"), "invalid_coupon");
	assert.equal(await quote(id, "nope"), "plan_not_found");
});
