import type { PaymentProvider } from "./payment.ts";

/** In-memory provider for tests: records onboarding calls, payout enablement is switchable. */
export function fakePayments() {
	const fake = {
		onboarded: [] as string[],
		refunded: [] as string[],
		charges: [] as { amountCents: number; walletId: string }[],
		enabled: false,
		fail: false,
	};
	const provider: PaymentProvider = {
		async createPayoutAccount(c) {
			if (fake.fail) throw new Error("provider down");
			fake.onboarded.push(c.email);
			return { accountId: `acc_${c.email}`, walletId: "w", apiKey: "k" };
		},
		async isPayoutEnabled() {
			return fake.enabled;
		},
		async createCharge(c) {
			fake.charges.push({ amountCents: c.amountCents, walletId: c.walletId });
			return { chargeId: `pay_${fake.charges.length}_${Date.now()}`, url: "u" };
		},
		async refund(chargeId) {
			if (fake.fail) throw new Error("asaas 400");
			fake.refunded.push(chargeId);
		},
		parseWebhook: (_h, body) => {
			const b = body as {
				eventId?: string;
				chargeId?: string;
				type?: "paid" | "refunded";
				netCents?: number;
			} | null;
			return b?.eventId && b.chargeId
				? {
						eventId: b.eventId,
						type: b.type ?? "paid",
						chargeId: b.chargeId,
						netCents: b.netCents,
					}
				: null;
		},
	};
	return { fake, provider };
}
