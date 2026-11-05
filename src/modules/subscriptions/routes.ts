import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import type { Charge, User } from "../../generated/prisma/client.ts";
import type { Buyer, PaymentProvider } from "../../providers/payment.ts";
import { requireVerified } from "../auth/guards.ts";
import { quote } from "../coupons/coupons.ts";
import { isSellable, paymentsOf } from "../payouts/payouts.ts";
import { expireStaleCharges } from "./subscriptions.ts";

const DUE_DAYS = 3;

const buyerSchema = z.strictObject({
	name: z.string().min(1).max(200),
	cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/),
});
// The buyer is sent per request and forwarded to the provider; never stored here.
const purchaseSchema = z.strictObject({
	planId: z.uuid(),
	couponCode: z.string().min(1).max(50).optional(),
	buyer: buyerSchema,
});
// A renewal may omit the buyer to reuse the one from the previous charge.
const renewSchema = purchaseSchema
	.omit({ planId: true })
	.extend({ buyer: buyerSchema.optional() });

type Failure = { status: number; error: string };

/**
 * Prices the plan server-side and opens a provider charge routed to the
 * creator. With `subscriptionId` (a renewal) a pending charge for the cycle is
 * reused instead of creating a second one.
 */
export async function openCharge(
	payments: PaymentProvider,
	user: Pick<User, "id" | "email">,
	input: {
		courseId: string;
		planId: string;
		couponCode?: string;
		buyer?: Pick<Buyer, "name" | "cpfCnpj">;
		subscriptionId?: string;
	},
): Promise<Failure | { charge: Charge }> {
	await expireStaleCharges();
	const course = await db.course.findUniqueOrThrow({
		where: { id: input.courseId },
		include: { owner: { include: { creatorProfile: true } } },
	});
	const wallet = course.owner.creatorProfile?.walletId;
	if (!wallet || !(await isSellable(payments, course.ownerId)))
		return { status: 409, error: "payouts_not_enabled" };

	if (input.subscriptionId) {
		const pending = await db.charge.findFirst({
			where: { subscriptionId: input.subscriptionId, status: "pending" },
		});
		if (pending) return { charge: pending };
	}
	let buyer = input.buyer;
	if (!buyer) {
		const last = await db.charge.findFirst({
			where: {
				userId: user.id,
				courseId: course.id,
				buyerCpfCnpj: { not: null },
			},
			orderBy: { createdAt: "desc" },
		});
		if (!last?.buyerName || !last.buyerCpfCnpj)
			return { status: 400, error: "buyer_required" };
		buyer = { name: last.buyerName, cpfCnpj: last.buyerCpfCnpj };
	}
	const q = await quote(course.id, input.planId, input.couponCode);
	if (typeof q === "string")
		return { status: q === "plan_not_found" ? 404 : 400, error: q };
	const plan = await db.plan.findUniqueOrThrow({
		where: { id: input.planId },
	});
	const dueAt = new Date(Date.now() + DUE_DAYS * 864e5);
	const { chargeId: providerId, url } = await payments.createCharge({
		buyer: { ...buyer, email: user.email },
		amountCents: q.amountCents,
		dueAt,
		description: course.title,
		reference: `${user.id}:${course.id}`,
		walletId: wallet,
	});
	try {
		const charge = await db.charge.create({
			data: {
				userId: user.id,
				courseId: course.id,
				planId: plan.id,
				subscriptionId: input.subscriptionId,
				amountCents: q.amountCents,
				months: plan.months,
				buyerName: buyer.name,
				buyerCpfCnpj: buyer.cpfCnpj,
				providerId,
				url,
				dueAt,
			},
		});
		return { charge };
	} catch (err) {
		// Lost a race with another pending charge for this cycle: use that one.
		const pending =
			input.subscriptionId &&
			(await db.charge.findFirst({
				where: { subscriptionId: input.subscriptionId, status: "pending" },
			}));
		if (pending) return { charge: pending };
		throw err;
	}
}

const sendCharge = (
	res: import("express").Response,
	out: Failure | { charge: Charge },
	status: number,
) =>
	"charge" in out
		? res.status(status).json({
				chargeId: out.charge.id,
				amountCents: out.charge.amountCents,
				url: out.charge.url,
			})
		: res.status(out.status).json({ error: out.error });

/** Mounted at `/courses/:id/purchase` behind `requireAuth`. */
export const purchaseRouter = Router({ mergeParams: true });

purchaseRouter.post("/", requireVerified, async (req, res) => {
	const input = purchaseSchema.safeParse(req.body);
	if (!input.success) {
		res
			.status(400)
			.json({ error: "invalid_input", issues: input.error.issues });
		return;
	}
	const user = req.user!;
	const course = await db.course.findFirst({
		where: { id: String(req.params.id), published: true },
	});
	if (!course) {
		res.status(404).json({ error: "not_found" });
		return;
	}
	const existing = await db.subscription.findUnique({
		where: { userId_courseId: { userId: user.id, courseId: course.id } },
	});
	if (existing) {
		res.status(409).json({ error: "already_subscribed" }); // renew instead
		return;
	}
	sendCharge(
		res,
		await openCharge(paymentsOf(req), user, {
			...input.data,
			courseId: course.id,
		}),
		201,
	);
});

/** Mounted at `/courses/:id/renew` behind `requireAuth`: renew at the subscription's current plan price. */
export const renewRouter = Router({ mergeParams: true });

renewRouter.post("/", requireVerified, async (req, res) => {
	const input = renewSchema.safeParse(req.body);
	if (!input.success) {
		res
			.status(400)
			.json({ error: "invalid_input", issues: input.error.issues });
		return;
	}
	const user = req.user!;
	const sub = await db.subscription.findUnique({
		where: {
			userId_courseId: { userId: user.id, courseId: String(req.params.id) },
		},
	});
	if (!sub) {
		res.status(404).json({ error: "not_found" });
		return;
	}
	if (sub.expiresAt === null || !sub.planId) {
		res.status(409).json({ error: "not_renewable" }); // lifetime, or the plan was removed
		return;
	}
	sendCharge(
		res,
		await openCharge(paymentsOf(req), user, {
			...input.data,
			courseId: sub.courseId,
			planId: sub.planId,
			subscriptionId: sub.id,
		}),
		201,
	);
});
