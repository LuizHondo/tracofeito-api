import { db } from "../../db.ts";

/** Calendar months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: Date, months: number) {
	const r = new Date(date);
	const day = r.getUTCDate();
	r.setUTCDate(1);
	r.setUTCMonth(r.getUTCMonth() + months);
	const last = new Date(
		Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0),
	).getUTCDate();
	r.setUTCDate(Math.min(day, last));
	return r;
}

/** Unpaid charges past their due date stop counting as pending, so a new cycle can start. */
export function expireStaleCharges(now = new Date()) {
	return db.charge.updateMany({
		where: { status: "pending", dueAt: { lt: now } },
		data: { status: "expired" },
	});
}

/**
 * A confirmed payment grants access: marks the charge paid and creates or
 * extends the subscription, in one transaction. Paying again is a no-op, so
 * duplicate provider events (same `eventId`, or same charge) extend `expiresAt` only once. Time is added to the
 * later of now and the current `expiresAt`; lifetime (null) never shrinks.
 */
export async function confirmCharge(
	providerId: string,
	now = new Date(),
	eventId?: string,
	netCents?: number,
) {
	return db.$transaction(async (tx) => {
		if (eventId) {
			const seen = await tx.providerEvent.createMany({
				data: { id: eventId },
				skipDuplicates: true,
			});
			if (!seen.count) return false;
		}
		const charge = await tx.charge.findUnique({ where: { providerId } });
		if (!charge) return false;
		const { count } = await tx.charge.updateMany({
			where: { id: charge.id, status: { in: ["pending", "expired"] } }, // a late payment still counts
			data: { status: "paid", paidAt: now, netCents },
		});
		if (!count) return false;

		const key = {
			userId_courseId: { userId: charge.userId, courseId: charge.courseId },
		};
		const sub = await tx.subscription.findUnique({ where: key });
		const base = sub?.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
		const expiresAt =
			charge.months === null || (sub && sub.expiresAt === null)
				? null
				: addMonths(base, charge.months);
		const { id } = await tx.subscription.upsert({
			where: key,
			create: {
				userId: charge.userId,
				courseId: charge.courseId,
				planId: charge.planId,
				expiresAt,
			},
			update: { expiresAt, planId: charge.planId },
		});
		await tx.charge.update({
			where: { id: charge.id },
			data: { subscriptionId: id },
		});
		return true;
	});
}

/**
 * A confirmed refund takes back the access the charge granted: subtracts its
 * months from `expiresAt` (access ends if that is no longer in the future) or,
 * for a lifetime charge, removes the subscription. Charges are kept for
 * history and income, progress is untouched. Idempotent like `confirmCharge`.
 */
export async function confirmRefund(
	providerId: string,
	now = new Date(),
	eventId?: string,
) {
	return db.$transaction(async (tx) => {
		if (eventId) {
			const seen = await tx.providerEvent.createMany({
				data: { id: eventId },
				skipDuplicates: true,
			});
			if (!seen.count) return false;
		}
		const charge = await tx.charge.findUnique({ where: { providerId } });
		if (!charge) return false;
		const { count } = await tx.charge.updateMany({
			where: { id: charge.id, status: "paid" },
			data: { status: "refunded", refundedAt: now },
		});
		if (!count || !charge.subscriptionId) return !!count;

		const sub = await tx.subscription.findUnique({
			where: { id: charge.subscriptionId },
		});
		if (!sub) return true;
		if (charge.months === null) {
			await tx.subscription.delete({ where: { id: sub.id } });
		} else if (sub.expiresAt) {
			await tx.subscription.update({
				where: { id: sub.id },
				data: { expiresAt: addMonths(sub.expiresAt, -charge.months) },
			});
		}
		return true;
	});
}
