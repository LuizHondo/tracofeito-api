import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCouponValue } from "./coupon.ts";

test("parses percent and fixed", () => {
	assert.deepEqual(parseCouponValue("30%"), { type: "percent", value: 30 });
	assert.deepEqual(parseCouponValue("100%"), { type: "percent", value: 100 });
	assert.deepEqual(parseCouponValue("30"), { type: "fixed", value: 30 });
	assert.deepEqual(parseCouponValue("12,5"), { type: "fixed", value: 12.5 });
});

test("rejects invalid", () => {
	for (const s of [
		"0%",
		"150%",
		"-5",
		"-5%",
		"0",
		"abc",
		"",
		"%",
		"10%%",
		"1e3",
	]) {
		assert.equal(parseCouponValue(s), null, s);
	}
});
