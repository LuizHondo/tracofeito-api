import assert from "node:assert/strict";
import { test } from "node:test";
import { blockSchema, youtubeId } from "./blocks.ts";

test("accepts valid blocks", () => {
	for (const b of [
		{ type: "title", config: { text: "Hi" } },
		{ type: "text", config: { markdown: "# x" } },
		{ type: "image", config: { url: "https://a.com/i.png" } },
		{ type: "video", config: { videoId: "abc" } },
		{ type: "video", config: { youtubeId: "dQw4w9WgXcQ" } },
		{ type: "url", config: { url: "https://a.com", label: "A" } },
	]) {
		assert.ok(blockSchema.safeParse(b).success, b.type);
	}
});

test("rejects malformed blocks", () => {
	for (const b of [
		{ type: "url", config: { url: "not a url", label: "A" } },
		{ type: "url", config: { url: "javascript:alert(1)", label: "A" } },
		{ type: "title", config: { text: "  " } },
		{ type: "video", config: {} },
		{ type: "zoom", config: { url: "https://zoom.us/j/1" } }, // removed type
		{ type: "poll", config: {} },
	]) {
		assert.ok(!blockSchema.safeParse(b).success, JSON.stringify(b));
	}
});

test("youtubeId parses common link shapes", () => {
	const id = "dQw4w9WgXcQ";
	for (const l of [
		`https://www.youtube.com/watch?v=${id}&t=3`,
		`https://youtu.be/${id}?si=x`,
		`https://youtube.com/shorts/${id}`,
		`https://m.youtube.com/embed/${id}`,
	])
		assert.equal(youtubeId(l), id);
	for (const l of [
		"https://vimeo.com/123",
		"https://evil.com/watch?v=" + id,
		"nope",
	])
		assert.equal(youtubeId(l), null);
});
