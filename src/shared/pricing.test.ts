import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCoupon, MIN_CHARGE_CENTS, planPriceCents } from "./pricing.ts";

test("plan price", () => {
	assert.equal(planPriceCents(10000, 12, 20), 96000);
	assert.equal(planPriceCents(10000, 6), 60000);
	assert.equal(planPriceCents(10000, 1, 0), 10000);
});

test("coupon: percent, fixed, and clamp to the minimum charge", () => {
	assert.equal(applyCoupon(96000, { type: "percent", value: 30 }), 67200);
	assert.equal(applyCoupon(10000, { type: "fixed", value: 30 }), 7000);
	assert.equal(
		applyCoupon(10000, { type: "fixed", value: 500 }),
		MIN_CHARGE_CENTS,
	);
	assert.equal(
		applyCoupon(10000, { type: "percent", value: 100 }),
		MIN_CHARGE_CENTS,
	);
	assert.equal(applyCoupon(10000), 10000);
});
