import assert from "node:assert/strict";
import { test } from "node:test";
import { isOwnerOrAdmin } from "./guards.ts";

test("ownership: owner and admin yes, other user or creator no", () => {
	const creatorA = { id: "a", role: "creator" } as const;
	const creatorB = { id: "b", role: "creator" } as const;
	const admin = { id: "z", role: "admin" } as const;
	assert.ok(isOwnerOrAdmin(creatorA, "a"));
	assert.ok(!isOwnerOrAdmin(creatorB, "a"));
	assert.ok(isOwnerOrAdmin(admin, "a"));
	assert.ok(!isOwnerOrAdmin({ id: "u2", role: "user" }, "u1"));
});
