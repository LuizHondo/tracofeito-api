import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../app.ts";
import { db } from "../../db.ts";
import type { VideoHost } from "../../providers/video.ts";
import { hashPassword } from "../auth/password.ts";
import { startSession } from "../auth/session.ts";

const fakeHost: VideoHost = {
	createUpload: async () => ({
		videoId: "vid-test-1",
		upload: { url: "u", headers: {} },
	}),
	parseWebhook: (b) => b as { videoId: string; status: "ready" } | null,
	playbackUrl: (id, exp) => `play:${id}:${exp.getTime()}`,
};
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
let base: string;
const clean = async () => {
	const owner = { email: { endsWith: "@video.test" } };
	await db.course.deleteMany({ where: { owner } });
	await db.user.deleteMany({ where: owner });
};

async function mkUser(name: string, role: "user" | "creator") {
	const user = await db.user.create({
		data: {
			email: `${name}@video.test`,
			username: `vt_${name}`,
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
		call: (path: string, init: RequestInit = {}) =>
			fetch(base + path, {
				...init,
				headers: { cookie, "content-type": "application/json" },
			}),
	};
}

before(async () => {
	await clean();
	server = createApp({ send: async () => {} }, () => fakeHost).listen(0);
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
	server.close();
	await clean();
	await db.$disconnect();
});

test("upload -> ready via webhook -> playback only with access", async () => {
	const creator = await mkUser("c", "creator");
	const other = await mkUser("o", "creator");
	const member = await mkUser("m", "user");
	const stranger = await mkUser("s", "user");
	const course = await db.course.create({
		data: { ownerId: creator.id, title: "T", baseMonthlyCents: 100 },
	});
	await db.subscription.create({
		data: { userId: member.id, courseId: course.id, expiresAt: null },
	});

	const post = (u: typeof creator, path: string, body: unknown) =>
		u.call(path, { method: "POST", body: JSON.stringify(body) });

	// only the owner uploads
	assert.equal(
		(await post(other, `/courses/${course.id}/videos`, { title: "x" })).status,
		403,
	);
	const up = await post(creator, `/courses/${course.id}/videos`, {
		title: "Aula",
	});
	assert.equal(up.status, 201);
	const { videoId } = (await up.json()) as { videoId: string };

	// processing: visible to the owner, not playable
	const status = await creator.call(`/courses/${course.id}/videos/${videoId}`);
	assert.equal(
		((await status.json()) as { status: string }).status,
		"processing",
	);
	const play = `/content/${course.id}/videos/${videoId}/playback`;
	assert.equal((await member.call(play)).status, 404);

	// a video block must reference a video of the same course
	const block = (id: string) =>
		post(creator, `/courses/${course.id}/blocks`, {
			type: "video",
			config: { videoId: id },
		});
	assert.equal((await block("nope")).status, 400);
	assert.equal((await block(videoId)).status, 201);

	// host webhook marks it ready
	const hook = await fetch(`${base}/webhooks/video`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ videoId, status: "ready" }),
	});
	assert.equal(hook.status, 204);

	const ok = await member.call(play);
	assert.equal(ok.status, 200);
	assert.match(((await ok.json()) as { url: string }).url, /^play:vid-test-1:/);
	assert.equal((await stranger.call(play)).status, 403);
});
