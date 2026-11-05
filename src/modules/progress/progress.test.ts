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
	const owner = { email: { endsWith: "@progress.test" } };
	await db.course.deleteMany({ where: { owner } });
	await db.user.deleteMany({ where: owner });
};

async function mkUser(name: string, role: "user" | "creator") {
	const user = await db.user.create({
		data: {
			email: `${name}@progress.test`,
			username: `pt_${name}`,
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
		call: (path: string, method = "GET") =>
			fetch(base + path, { method, headers: { cookie } }),
	};
}
type Progress = { total: number; percent: number; completedPageIds: string[] };

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

test("completion, percentage, visibility and survival past expiry", async () => {
	const creator = await mkUser("c", "creator");
	const other = await mkUser("o", "creator");
	const member = await mkUser("m", "user");
	const course = await db.course.create({
		data: { ownerId: creator.id, title: "T", baseMonthlyCents: 100 },
	});
	const mk = (slug: string, position: number) =>
		db.page.create({
			data: { courseId: course.id, title: slug, slug, position },
		});
	const [p1, p2] = [await mk("a", 0), await mk("b", 1)];
	const sub = await db.subscription.create({
		data: { userId: member.id, courseId: course.id, expiresAt: null },
	});
	const done = `/content/${course.id}/pages/${p1.id}/complete`;

	let r = (await (await member.call(done, "PUT")).json()) as Progress;
	assert.deepEqual([r.percent, r.total], [50, 2]);
	await member.call(`/content/${course.id}/pages/${p2.id}/complete`, "PUT");
	r = (await (
		await member.call(`/content/${course.id}/progress`)
	).json()) as Progress;
	assert.equal(r.percent, 100);

	// page added later drops the percentage
	await mk("c", 2);
	r = (await (
		await member.call(`/content/${course.id}/progress`)
	).json()) as Progress;
	assert.equal(r.percent, 67);

	// unmark
	r = (await (await member.call(done, "DELETE")).json()) as Progress;
	assert.equal(r.completedPageIds.length, 1);

	// creator sees own subscriber; another creator is rejected
	const view = `/courses/${course.id}/progress/${member.id}`;
	assert.equal((await creator.call(view)).status, 200);
	assert.equal((await other.call(view)).status, 403);

	// expired: can't mark, but progress is kept and still visible
	await db.subscription.update({
		where: { id: sub.id },
		data: { expiresAt: new Date(Date.now() - 1000) },
	});
	assert.equal((await member.call(done, "PUT")).status, 403);
	r = (await (await creator.call(view)).json()) as Progress;
	assert.equal(r.completedPageIds.length, 1);
});
