/** Recurring plan price in cents: base monthly x months x (1 - discount%). */
export function planPriceCents(
	baseMonthlyCents: number,
	months: number,
	discountPercent = 0,
): number {
	return Math.round(
		(baseMonthlyCents * months * (100 - discountPercent)) / 100,
	);
}

// Asaas minimum for "ask the customer" charges (confirmed in the sandbox spike, design.md)
export const MIN_CHARGE_CENTS = 500;

/** Applies at most one coupon; the result never drops below the minimum charge. */
export function applyCoupon(
	priceCents: number,
	coupon?: { type: "percent" | "fixed"; value: number },
	minCents = MIN_CHARGE_CENTS,
): number {
	const discount = !coupon
		? 0
		: coupon.type === "percent"
			? Math.round((priceCents * coupon.value) / 100)
			: Math.round(coupon.value * 100);
	return Math.max(priceCents - discount, minCents);
}

/** Price of a plan in cents: lifetime plans carry their own price. */
export function planTotalCents(
	baseMonthlyCents: number,
	plan: {
		months: number | null;
		discountPercent: number;
		lifetimeCents: number | null;
	},
): number {
	return plan.months === null
		? (plan.lifetimeCents ?? 0)
		: planPriceCents(baseMonthlyCents, plan.months, plan.discountPercent);
}
