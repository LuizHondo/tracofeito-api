import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { AsaasPaymentProvider } from "./payment.ts";

const asaas = new AsaasPaymentProvider("key", "hook", "https://x/v3");
const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

type Call = { url: string; method: string; key: string; body: unknown };
function mockFetch(replies: unknown[]) {
	const calls: Call[] = [];
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		calls.push({
			url,
			method: String(init.method),
			key: (init.headers as Record<string, string>).access_token,
			body: init.body ? JSON.parse(String(init.body)) : undefined,
		});
		return Response.json(replies.shift() ?? {});
	}) as typeof fetch;
	return calls;
}

test("createCharge makes a customer then a full-split charge in reais", async () => {
	const calls = mockFetch([{ id: "cus_1" }, { id: "pay_1", invoiceUrl: "u" }]);
	const out = await asaas.createCharge({
		buyer: { name: "A", email: "a@x.com", cpfCnpj: "1" },
		amountCents: 96000,
		dueAt: new Date("2026-11-01T12:00:00Z"),
		description: "Curso",
		reference: "ch1",
		walletId: "w1",
	});
	assert.deepEqual(out, { chargeId: "pay_1", url: "u" });
	assert.equal(calls[1].url, "https://x/v3/payments");
	assert.deepEqual(calls[1].body, {
		customer: "cus_1",
		billingType: "UNDEFINED",
		value: 960,
		dueDate: "2026-11-01",
		description: "Curso",
		externalReference: "ch1",
		split: [{ walletId: "w1", percentualValue: 100 }],
	});
});

test("createPayoutAccount returns the sub-account credentials", async () => {
	mockFetch([{ id: "a1", walletId: "w1", apiKey: "k1" }]);
	const acc = await asaas.createPayoutAccount({
		name: "C",
		email: "c@x.com",
		cpfCnpj: "1",
		mobilePhone: "1",
		postalCode: "1",
		addressNumber: "1",
		incomeValueCents: 500000,
	});
	assert.deepEqual(acc, { accountId: "a1", walletId: "w1", apiKey: "k1" });
});

test("payout is enabled only when the sub-account is approved, using its own key", async () => {
	const acc = { accountId: "a1", walletId: "w1", apiKey: "k1" };
	const calls = mockFetch([{ general: "PENDING" }]);
	assert.equal(await asaas.isPayoutEnabled(acc), false);
	assert.equal(calls[0].key, "k1");
	mockFetch([{ general: "APPROVED" }]);
	assert.equal(await asaas.isPayoutEnabled(acc), true);
});

test("refund posts to the payment and errors surface", async () => {
	const calls = mockFetch([{}]);
	await asaas.refund("pay_1");
	assert.equal(calls[0].url, "https://x/v3/payments/pay_1/refund");
	globalThis.fetch = (async () =>
		new Response("no", { status: 400 })) as typeof fetch;
	await assert.rejects(asaas.refund("pay_1"), /asaas 400/);
});

test("webhook maps events and rejects bad token or shape", () => {
	const hook = (event: string, token = "hook", netValue?: number) =>
		asaas.parseWebhook(
			{ "asaas-access-token": token },
			{ id: "evt_1", event, payment: { id: "pay_1", netValue } },
		);
	assert.deepEqual(hook("PAYMENT_CONFIRMED"), {
		eventId: "evt_1",
		type: "paid",
		chargeId: "pay_1",
		netCents: undefined,
	});
	assert.equal(hook("PAYMENT_RECEIVED", "hook", 939.5)?.netCents, 93950);
	assert.equal(hook("PAYMENT_RECEIVED")?.type, "paid");
	assert.equal(hook("PAYMENT_REFUNDED")?.type, "refunded");
	assert.equal(hook("PAYMENT_CREATED"), null);
	assert.equal(hook("PAYMENT_CONFIRMED", "bad"), null);
	assert.equal(asaas.parseWebhook({ "asaas-access-token": "hook" }, {}), null);
});
