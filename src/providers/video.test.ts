import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, test } from "node:test";
import { BunnyVideoHost } from "./video.ts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const host = new BunnyVideoHost("lib1", "key", "tok", 1000, () => 0);
const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

test("createUpload creates the video and signs a TUS upload", async () => {
	let call: { url: string; init: RequestInit } | undefined;
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		call = { url, init };
		return Response.json({ guid: "v1" });
	}) as typeof fetch;
	const { videoId, upload } = await host.createUpload("Aula 1");
	assert.equal(videoId, "v1");
	assert.equal(call?.url, "https://video.bunnycdn.com/library/lib1/videos");
	assert.deepEqual(JSON.parse(String(call?.init.body)), { title: "Aula 1" });
	assert.equal(upload.headers.AuthorizationExpire, "1");
	assert.equal(upload.headers.AuthorizationSignature, sha("lib1key1v1"));
});

test("createUpload surfaces host errors", async () => {
	globalThis.fetch = (async () =>
		new Response("no", { status: 401 })) as typeof fetch;
	await assert.rejects(host.createUpload("x"), /bunny 401/);
});

test("webhook maps statuses and rejects foreign or malformed bodies", () => {
	const hook = (Status: unknown, lib = "lib1") =>
		host.parseWebhook({ VideoLibraryId: lib, VideoGuid: "v1", Status });
	assert.deepEqual(hook(3), { videoId: "v1", status: "ready" });
	assert.equal(hook(2)?.status, "processing");
	assert.equal(hook(5)?.status, "failed");
	assert.equal(hook(3, "other"), null);
	assert.equal(hook("3"), null);
	assert.equal(host.parseWebhook(null), null);
});

test("playback URL carries a token bound to video and expiry", () => {
	const url = new URL(host.playbackUrl("v1", new Date(60_000)));
	assert.equal(url.pathname, "/embed/lib1/v1");
	assert.equal(url.searchParams.get("expires"), "60");
	assert.equal(url.searchParams.get("token"), sha("tokv160"));
});
