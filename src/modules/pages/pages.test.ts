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
	const owner = { email: { endsWith: "@pages.test" } };
	await db.course.deleteMany({ where: { owner } });
	await db.user.deleteMany({ where: owner });
};

async function login(name: string, role: "creator" | "admin") {
	const user = await db.user.create({
		data: {
			email: `${name}@pages.test`,
			username: `p_${name}`,
			passwordHash: await hashPassword("x"),
			role,
			emailVerified: true,
		},
	});
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

type P = {
	id: string;
	slug: string;
	parentId: string | null;
	position: number;
};

test("page tree: nesting, reorder, slug uniqueness, cycles, ownership", async () => {
	const a = await login("a", "creator");
	const b = await login("b", "creator");
	const c = (
		(await (
			await a("POST", "/courses", { title: "T", baseMonthlyCents: 1000 })
		).json()) as { id: string }
	).id;
	const url = `/courses/${c}/pages`;
	const mk = async (slug: string, extra = {}) =>
		(await (await a("POST", url, { title: slug, slug, ...extra })).json()) as P;

	const one = await mk("one");
	const two = await mk("two");
	const three = await mk("three");
	assert.deepEqual(
		[one, two, three].map((p) => p.position),
		[0, 1, 2],
	);

	// slug unique among siblings only
	assert.equal((await a("POST", url, { title: "x", slug: "one" })).status, 409);
	const nested = await mk("one", { parentId: two.id });
	assert.equal(nested.parentId, two.id);

	// reorder: move "three" to the front
	assert.equal(
		(await a("PATCH", `${url}/${three.id}`, { position: 0 })).status,
		200,
	);
	const list = (await (await a("GET", url)).json()) as P[];
	const roots = list
		.filter((p) => !p.parentId)
		.sort((x, y) => x.position - y.position);
	assert.deepEqual(
		roots.map((p) => p.slug),
		["three", "one", "two"],
	);

	// re-nest: sidebar sees the new structure
	await a("PATCH", `${url}/${three.id}`, { parentId: one.id });
	const after = (await (await a("GET", url)).json()) as P[];
	assert.equal(after.find((p) => p.id === three.id)?.parentId, one.id);
	assert.deepEqual(
		after
			.filter((p) => !p.parentId)
			.sort((x, y) => x.position - y.position)
			.map((p) => p.slug),
		["one", "two"],
	);

	// moving into a slug collision, own descendant, or itself is rejected
	assert.equal(
		(await a("PATCH", `${url}/${nested.id}`, { parentId: null })).status,
		409,
	);
	assert.equal(
		(await a("PATCH", `${url}/${two.id}`, { parentId: nested.id })).status,
		400,
	);
	assert.equal(
		(await a("PATCH", `${url}/${two.id}`, { parentId: two.id })).status,
		400,
	);

	// other creator is locked out
	assert.equal((await b("GET", url)).status, 403);
	assert.equal((await b("POST", url, { title: "x", slug: "x" })).status, 403);
	assert.equal((await b("DELETE", `${url}/${one.id}`)).status, 403);
});

type B = {
	id: string;
	type: string;
	position: number;
	config: { text?: string };
};

test("blocks: validated on write, reorderable, selling page separate, owner only", async () => {
	const a = await login("ba", "creator");
	const b = await login("bb", "creator");
	const c = (
		(await (
			await a("POST", "/courses", { title: "T", baseMonthlyCents: 1000 })
		).json()) as {
			id: string;
		}
	).id;
	const page = (
		(await (
			await a("POST", `/courses/${c}/pages`, { title: "p", slug: "p" })
		).json()) as P
	).id;
	const url = `/courses/${c}/pages/${page}/blocks`;
	const title = (text: string, extra = {}) =>
		a("POST", url, { type: "title", config: { text }, ...extra });

	const first = (await (await title("one")).json()) as B;
	await title("two");
	await title("zero", { position: 0 });

	// invalid configs and unknown types are rejected; stored content is kept
	assert.equal(
		(await a("POST", url, { type: "url", config: { url: "nope", label: "x" } }))
			.status,
		400,
	);
	assert.equal(
		(await a("POST", url, { type: "bogus", config: {} })).status,
		400,
	);
	assert.equal(
		(await a("PATCH", `${url}/${first.id}`, { config: { text: "" } })).status,
		400,
	);
	let list = (await (await a("GET", url)).json()) as B[];
	assert.deepEqual(
		list.map((x) => x.config.text),
		["zero", "one", "two"],
	);

	// reorder + edit
	assert.equal(
		(
			await a("PATCH", `${url}/${first.id}`, {
				position: 2,
				config: { text: "ONE" },
			})
		).status,
		200,
	);
	list = (await (await a("GET", url)).json()) as B[];
	assert.deepEqual(
		list.map((x) => x.config.text),
		["zero", "two", "ONE"],
	);

	// selling page blocks live apart from page blocks
	const selling = `/courses/${c}/blocks`;
	assert.equal(
		(await a("POST", selling, { type: "text", config: { markdown: "hi" } }))
			.status,
		201,
	);
	assert.equal(((await (await a("GET", selling)).json()) as B[]).length, 1);
	assert.equal(((await (await a("GET", url)).json()) as B[]).length, 3);

	// other creator is locked out
	assert.equal((await b("GET", url)).status, 403);
	assert.equal((await b("DELETE", `${url}/${first.id}`)).status, 403);
	assert.equal((await a("DELETE", `${url}/${first.id}`)).status, 204);
});
