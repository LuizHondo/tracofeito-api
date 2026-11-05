import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../app.ts";
import { db } from "../../db.ts";
import { fakePayments } from "../../providers/payment.fake.ts";
import { hashPassword } from "../auth/password.ts";
import { startSession } from "../auth/session.ts";
import { isSellable } from "./payouts.ts";

const payments = fakePayments();
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let base: string;
const clean = async () => {
	const owner = { email: { endsWith: "@payouts.test" } };
	await db.course.deleteMany({ where: { owner } });
	await db.user.deleteMany({ where: owner });
};
const payout = {
	name: "Creator",
	cpfCnpj: "52998224725",
	mobilePhone: "11999999999",
	postalCode: "01310100",
	addressNumber: "1",
};

async function creator(name: string) {
	const user = await db.user.create({
		data: {
			email: `${name}@payouts.test`,
			username: `po_${name}`,
			passwordHash: await hashPassword("x"),
			role: "creator",
			emailVerified: true,
		},
	});
	let cookie = "";
	await startSession(
		{ cookie: (_n: string, v: string) => (cookie = `sid=${v}`) } as never,
		user.id,
	);
	return {
		id: user.id,
		call: (method: string, path: string, body?: unknown) =>
			fetch(base + path, {
				method,
				headers: { cookie, "content-type": "application/json" },
				body: body === undefined ? undefined : JSON.stringify(body),
			}),
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

test("creator opens the payout account once, separately from courses", async () => {
	const c = await creator("first");
	assert.deepEqual(await (await c.call("GET", "/payouts/status")).json(), {
		status: "none",
	});
	assert.equal(
		(await c.call("POST", "/courses", { title: "T", baseMonthlyCents: 1000 }))
			.status,
		201,
	); // no payout details needed to create a course
	assert.equal((await c.call("POST", "/payouts", { name: "x" })).status, 400);

	assert.equal((await c.call("POST", "/payouts", payout)).status, 201);
	assert.deepEqual(payments.fake.onboarded, ["first@payouts.test"]);
	assert.deepEqual(await (await c.call("GET", "/payouts/status")).json(), {
		status: "pending",
	});

	assert.equal((await c.call("POST", "/payouts", payout)).status, 201);
	assert.equal(payments.fake.onboarded.length, 1);
});

test("provider failure creates no account", async () => {
	const c = await creator("down");
	payments.fake.fail = true;
	const res = await c.call("POST", "/payouts", payout);
	payments.fake.fail = false;
	assert.equal(res.status, 502);
	assert.equal(await db.creatorProfile.count({ where: { userId: c.id } }), 0);
});

test("sellable only once the provider reports payouts enabled", async () => {
	const c = await creator("sell");
	assert.equal(await isSellable(payments.provider, c.id), false); // no account
	await c.call("POST", "/payouts", payout);
	payments.fake.enabled = false;
	assert.equal(await isSellable(payments.provider, c.id), false); // pending
	payments.fake.enabled = true;
	assert.equal(await isSellable(payments.provider, c.id), true);
	payments.fake.enabled = false; // enablement is remembered
	assert.equal(await isSellable(payments.provider, c.id), true);
	assert.equal(
		(await db.creatorProfile.findUniqueOrThrow({ where: { userId: c.id } }))
			.payoutEnabled,
		true,
	);
});
