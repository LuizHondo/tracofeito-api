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
	const owner = { email: { endsWith: "@content.test" } };
	await db.course.deleteMany({ where: { owner } });
	await db.user.deleteMany({ where: owner });
};

async function mkUser(name: string, role: "user" | "creator") {
	const user = await db.user.create({
		data: {
			email: `${name}@content.test`,
			username: `ct_${name}`,
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
		call: (path: string) => fetch(base + path, { headers: { cookie } }),
	};
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

test("selling page is public; members area needs unexpired access", async () => {
	const creator = await mkUser("c", "creator");
	const active = await mkUser("active", "user");
	const lifetime = await mkUser("life", "user");
	const expired = await mkUser("exp", "user");
	const stranger = await mkUser("none", "user");

	const course = await db.course.create({
		data: {
			ownerId: creator.id,
			title: "T",
			baseMonthlyCents: 10000,
			published: true,
		},
	});
	await db.plan.create({
		data: { courseId: course.id, months: 12, discountPercent: 20 },
	});
	await db.block.create({
		data: {
			courseId: course.id,
			pageId: null,
			position: 0,
			type: "title",
			config: { text: "Sell" },
		},
	});
	const mkPage = (slug: string, position: number, parentId?: string) =>
		db.page.create({
			data: { courseId: course.id, title: slug, slug, position, parentId },
		});
	const p1 = await mkPage("a", 0);
	const p2 = await mkPage("b", 1);
	const child = await mkPage("a1", 0, p1.id);
	const day = 86_400_000;
	for (const [u, expiresAt] of [
		[active, new Date(Date.now() + day)],
		[lifetime, null],
		[expired, new Date(Date.now() - day)],
	] as const) {
		await db.subscription.create({
			data: { userId: u.id, courseId: course.id, expiresAt },
		});
	}

	// anonymous: selling page ok (with computed price), members area 401
	const sell = (await (
		await fetch(`${base}/content/${course.id}/selling`)
	).json()) as {
		blocks: unknown[];
		plans: { priceCents: number }[];
	};
	assert.equal(sell.blocks.length, 1);
	assert.equal(sell.plans[0]?.priceCents, 96000);
	assert.equal((await fetch(`${base}/content/${course.id}/pages`)).status, 401);

	// drafts are not on sale
	await db.course.update({
		where: { id: course.id },
		data: { published: false },
	});
	assert.equal(
		(await fetch(`${base}/content/${course.id}/selling`)).status,
		404,
	);

	// access matrix
	for (const [who, status] of [
		[active, 200],
		[lifetime, 200],
		[creator, 200],
		[expired, 403],
		[stranger, 403],
	] as const) {
		assert.equal(
			(await who.call(`/content/${course.id}/pages`)).status,
			status,
		);
		assert.equal(
			(await who.call(`/content/${course.id}/pages/${p1.id}`)).status,
			status,
		);
	}

	// tree order and prev/next
	const list = (await (
		await active.call(`/content/${course.id}/pages`)
	).json()) as { id: string }[];
	assert.deepEqual(
		list.map((p) => p.id),
		[p1.id, child.id, p2.id],
	);
	const page = (await (
		await active.call(`/content/${course.id}/pages/${p1.id}`)
	).json()) as {
		prevId: string | null;
		nextId: string | null;
	};
	assert.deepEqual([page.prevId, page.nextId], [null, child.id]);
});
