import { applyCoupon, planTotalCents } from "../../shared/index.ts";
import { db } from "../../db.ts";

export const normalizeCode = (code: string) => code.trim().toUpperCase();

/** Active = not canceled and not expired; null for unknown or inactive codes. */
export const findActiveCoupon = (courseId: string, code: string) =>
	db.coupon.findFirst({
		where: {
			courseId,
			code: normalizeCode(code),
			canceledAt: null,
			expiresAt: { gt: new Date() },
		},
	});

export type QuoteError = "plan_not_found" | "invalid_coupon";

/**
 * Server-side charge amount for a plan, with at most one coupon.
 * Clients never send amounts; purchase and renewal call this.
 */
export async function quote(
	courseId: string,
	planId: string,
	couponCode?: string,
): Promise<
	{ amountCents: number; planCents: number; couponId?: string } | QuoteError
> {
	const plan = await db.plan.findFirst({
		where: { id: planId, courseId },
		include: { course: true },
	});
	if (!plan) return "plan_not_found";
	const planCents = planTotalCents(plan.course.baseMonthlyCents, plan);
	if (!couponCode) return { amountCents: planCents, planCents };
	const coupon = await findActiveCoupon(courseId, couponCode);
	if (!coupon) return "invalid_coupon";
	return {
		amountCents: applyCoupon(planCents, {
			type: coupon.type,
			value: Number(coupon.value),
		}),
		planCents,
		couponId: coupon.id,
	};
}
