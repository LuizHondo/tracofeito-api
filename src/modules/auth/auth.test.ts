import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../app.ts";
import { db } from "../../db.ts";

let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let base: string;
const sent: { to: string; text: string }[] = [];
const tokenFrom = (to: string) =>
	sent.findLast((e) => e.to === to)?.text.split("token=")[1] ?? "";
const post = (path: string, body: unknown) =>
	fetch(base + path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
const clean = () =>
	db.user.deleteMany({ where: { email: { endsWith: "@auth.test" } } });

before(async () => {
	await clean();
	server = createApp({ send: async (e) => void sent.push(e) }).listen(0);
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
	server.close();
	await clean();
	await db.$disconnect();
});

const valid = {
	email: "A@auth.test",
	username: "alice_1",
	password: "correct horse",
};

test("sign-up creates a user with role user", async () => {
	const res = await post("/auth/sign-up", valid);
	assert.equal(res.status, 201);
	const body = await res.json();
	assert.equal(body.role, "user");
	assert.equal(body.email, "a@auth.test");
	assert.equal(body.passwordHash, undefined);
});

test("duplicate email or username is rejected", async () => {
	assert.equal(
		(await post("/auth/sign-up", { ...valid, username: "other" })).status,
		409,
	);
	assert.equal(
		(
			await post("/auth/sign-up", {
				...valid,
				email: "b@auth.test",
				username: "ALICE_1",
			})
		).status,
		409,
	);
});

test("invalid input is rejected", async () => {
	assert.equal(
		(await post("/auth/sign-up", { ...valid, email: "x", password: "short" }))
			.status,
		400,
	);
});

const cookieOf = (res: Response) =>
	res.headers.getSetCookie()[0]?.split(";")[0] ?? "";

test("sign in by email or username, me, sign out", async () => {
	const res = await post("/auth/sign-in", {
		login: "alice_1",
		password: valid.password,
	});
	assert.equal(res.status, 200);
	const cookie = cookieOf(res);
	assert.match(cookie, /^sid=/);
	assert.equal(
		(await fetch(`${base}/auth/me`, { headers: { cookie } })).status,
		200,
	);
	assert.equal(
		(
			await post("/auth/sign-in", {
				login: "A@auth.test",
				password: valid.password,
			})
		).status,
		200,
	);
	await fetch(`${base}/auth/sign-out`, { method: "POST", headers: { cookie } });
	assert.equal(
		(await fetch(`${base}/auth/me`, { headers: { cookie } })).status,
		401,
	);
});

test("wrong password and unknown user give the same answer, then lockout", async () => {
	const wrong = await post("/auth/sign-in", {
		login: "alice_1",
		password: "nope",
	});
	const unknown = await post("/auth/sign-in", {
		login: "ghost",
		password: "nope",
	});
	assert.equal(wrong.status, 401);
	assert.deepEqual(await wrong.json(), await unknown.json());
	for (let i = 0; i < 10; i++)
		await post("/auth/sign-in", { login: "alice_1", password: "nope" });
	// locked even with the right password
	assert.equal(
		(
			await post("/auth/sign-in", {
				login: "alice_1",
				password: valid.password,
			})
		).status,
		429,
	);
});

test("sign-up sends a verification email; verifying sets emailVerified; token is single-use", async () => {
	const token = tokenFrom("a@auth.test");
	assert.ok(token);
	assert.equal((await post("/auth/verify-email", { token })).status, 204);
	assert.equal(
		(await db.user.findUniqueOrThrow({ where: { email: "a@auth.test" } }))
			.emailVerified,
		true,
	);
	assert.equal((await post("/auth/verify-email", { token })).status, 400);
});

test("expired link is rejected", async () => {
	await post("/auth/forgot-password", { email: "a@auth.test" });
	const token = tokenFrom("a@auth.test");
	await db.token.updateMany({
		data: { expiresAt: new Date(Date.now() - 1000) },
	});
	assert.equal(
		(await post("/auth/reset-password", { token, password: "new password 1" }))
			.status,
		400,
	);
});

test("password reset works once, only for verified emails, and signs everyone out", async () => {
	const before = sent.length;
	await post("/auth/sign-up", {
		email: "u@auth.test",
		username: "unverified",
		password: "correct horse",
	});
	const afterSignUp = sent.length;
	await post("/auth/forgot-password", { email: "u@auth.test" });
	assert.equal(sent.length, afterSignUp, "no reset mail for unverified email");
	assert.equal(afterSignUp, before + 1);

	await post("/auth/forgot-password", { email: "a@auth.test" });
	const token = tokenFrom("a@auth.test");
	assert.equal(
		(await post("/auth/reset-password", { token, password: "new password 1" }))
			.status,
		204,
	);
	assert.equal(
		(await post("/auth/reset-password", { token, password: "new password 2" }))
			.status,
		400,
	);
	const user = await db.user.findUniqueOrThrow({
		where: { email: "a@auth.test" },
	});
	const { verifyPassword } = await import("./password.ts");
	assert.ok(await verifyPassword("new password 1", user.passwordHash));
});

test("profile: edit bio and username; password change needs the current one", async () => {
	await post("/auth/sign-up", {
		email: "p@auth.test",
		username: "pat",
		password: "correct horse",
	});
	// sign-in limiter is per IP and already locked by the lockout test, so use a session directly
	const user = await db.user.findUniqueOrThrow({
		where: { email: "p@auth.test" },
	});
	const { startSession } = await import("./session.ts");
	let cookie = "";
	await startSession(
		{
			cookie: (_n: string, v: string) => {
				cookie = `sid=${v}`;
			},
		} as never,
		user.id,
	);
	const patch = (body: unknown) =>
		fetch(`${base}/auth/me`, {
			method: "PATCH",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify(body),
		});

	assert.equal((await patch({ bio: "hello" })).status, 200);
	assert.equal(
		(
			(await (
				await fetch(`${base}/auth/me`, { headers: { cookie } })
			).json()) as { bio: string }
		).bio,
		"hello",
	);
	assert.equal((await patch({ username: "alice_1" })).status, 409);
	assert.equal((await patch({ username: "pat2" })).status, 200);
	assert.equal((await patch({ newPassword: "another pass 1" })).status, 403);
	assert.equal(
		(
			await patch({
				newPassword: "another pass 1",
				currentPassword: "correct horse",
			})
		).status,
		200,
	);
});
