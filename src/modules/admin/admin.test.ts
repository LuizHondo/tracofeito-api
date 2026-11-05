import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../app.ts";
import { db } from "../../db.ts";
import { fakePayments } from "../../providers/payment.fake.ts";
import { hashPassword } from "../auth/password.ts";
import { startSession } from "../auth/session.ts";

const payments = fakePayments();
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let base: string;
const clean = async () => {
	const owner = { email: { endsWith: "@admin.test" } };
	await db.course.deleteMany({ where: { owner } });
	await db.user.deleteMany({ where: owner });
};

async function mkUser(name: string, role: "user" | "creator" | "admin") {
	const user = await db.user.create({
		data: {
			email: `${name}@admin.test`,
			username: `adm_${name}`,
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
	return {
		id: user.id,
		call: (path: string, method = "GET", body?: unknown) =>
			fetch(base + path, {
				method,
				headers: { cookie, "content-type": "application/json" },
				body: body ? JSON.stringify(body) : undefined,
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

test("admin manages users; others are refused", async () => {
	const admin = await mkUser("a", "admin");
	const creator = await mkUser("c", "creator");
	const user = await mkUser("u", "user");

	assert.equal((await creator.call("/admin/users")).status, 403);
	assert.equal(
		(await creator.call(`/admin/users/${user.id}/suspend`, "POST")).status,
		403,
	);

	const found = (await (
		await admin.call("/admin/users?q=adm_u&role=user")
	).json()) as { id: string }[];
	assert.deepEqual(
		found.map((u) => u.id),
		[user.id],
	);

	// suspend: existing session dies at once
	assert.equal((await user.call("/courses/mine")).status, 403);
	assert.equal(
		(await admin.call(`/admin/users/${user.id}/suspend`, "POST")).status,
		204,
	);
	assert.equal((await user.call("/courses/mine")).status, 401);
	assert.equal(
		(await admin.call(`/admin/users/${user.id}/restore`, "POST")).status,
		204,
	);

	// promote to creator -> can create courses
	const course = {
		title: "T",
		baseMonthlyCents: 100,
	};
	assert.equal((await user.call("/courses", "POST", course)).status, 401); // old session was deleted
	assert.equal(
		(
			await admin.call(`/admin/users/${user.id}/role`, "PUT", {
				role: "creator",
			})
		).status,
		204,
	);
	const fresh = await mkUser("u2", "user");
	await admin.call(`/admin/users/${fresh.id}/role`, "PUT", { role: "creator" });
	assert.equal((await fresh.call("/courses", "POST", course)).status, 201);

	assert.equal(
		(await admin.call(`/admin/users/${admin.id}/suspend`, "POST")).status,
		400,
	);
	assert.equal(
		(await admin.call(`/admin/users/${user.id}/role`, "PUT", { role: "x" }))
			.status,
		400,
	);
});

test("unpublishing keeps subscriber access; admin lists all courses", async () => {
	const admin = await mkUser("a2", "admin");
	const creator = await mkUser("c2", "creator");
	const member = await mkUser("m2", "user");
	const course = await db.course.create({
		data: {
			ownerId: creator.id,
			title: "T",
			baseMonthlyCents: 100,
			published: true,
		},
	});
	await db.subscription.create({
		data: { userId: member.id, courseId: course.id, expiresAt: null },
	});
	const listed = (await (await admin.call("/admin/courses")).json()) as {
		id: string;
	}[];
	assert.ok(listed.some((c) => c.id === course.id));
	assert.equal(
		(await admin.call(`/courses/${course.id}`, "PATCH", { published: false }))
			.status,
		200,
	);
	assert.equal((await member.call(`/content/${course.id}/pages`)).status, 200);
});
