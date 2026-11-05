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
	const owner = { email: { endsWith: "@catalog.test" } };
	await db.course.deleteMany({ where: { owner } });
	await db.user.deleteMany({ where: owner });
};

async function mkUser(name: string, role: "creator" | "admin") {
	const user = await db.user.create({
		data: {
			email: `${name}@catalog.test`,
			username: `cat_${name}`,
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
		put: (path: string, body: unknown) =>
			fetch(base + path, {
				method: "PUT",
				headers: { cookie, "content-type": "application/json" },
				body: JSON.stringify(body),
			}),
	};
}
type Catalog = {
	featured: { id: string }[];
	courses: { id: string; startingPriceCents: number }[];
};
const catalog = async () =>
	(await (await fetch(`${base}/catalog`)).json()) as Catalog;

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

test("catalog shows published sellable courses at their lowest price; only admins feature", async () => {
	const creator = await mkUser("c", "creator");
	const admin = await mkUser("a", "admin");
	const mk = (title: string, published: boolean) =>
		db.course.create({
			data: { ownerId: creator.id, title, baseMonthlyCents: 10000, published },
		});
	const live = await mk("live", true);
	const draft = await mk("draft", false);
	await db.plan.createMany({
		data: [
			{ courseId: live.id, months: 1 },
			{ courseId: live.id, months: 6, discountPercent: 5 },
			{ courseId: live.id, months: null, lifetimeCents: 90000 },
			{ courseId: draft.id, months: 1 },
		],
	});

	let c = await catalog();
	const card = c.courses.find((x) => x.id === live.id);
	assert.equal(card?.startingPriceCents, 10000);
	assert.ok(!c.courses.some((x) => x.id === draft.id));
	assert.ok(!c.featured.some((x) => x.id === live.id));

	const path = `/admin/courses/${live.id}/featured`;
	assert.equal((await creator.put(path, { featured: true })).status, 403);
	assert.equal((await admin.put(path, { featured: true })).status, 204);
	c = await catalog();
	assert.ok(c.featured.some((x) => x.id === live.id));
});
