import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "./app.ts";

test("GET /health returns 200", async () => {
	const server = createApp().listen(0);
	try {
		const { port } = server.address() as AddressInfo;
		const res = await fetch(`http://127.0.0.1:${port}/health`);
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { ok: true });
	} finally {
		server.close();
	}
});
