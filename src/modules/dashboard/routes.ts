import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import { courseProgress } from "../progress/routes.ts";

const filterSchema = z.object({
	courseId: z.uuid().optional(),
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
});

/** Creator panel data, mounted at `/dashboard` for creators and admins; always scoped to the caller's own courses. */
export const dashboardRouter = Router();

/** Sales in a period (by payment date) with refunds shown against the sale. */
dashboardRouter.get("/income", async (req, res) => {
	const f = filterSchema.safeParse(req.query);
	if (!f.success) {
		res.status(400).json({ error: "invalid_input" });
		return;
	}
	const { courseId, from, to } = f.data;
	const charges = await db.charge.findMany({
		where: {
			status: { in: ["paid", "refunded"] },
			course: { ownerId: req.user!.id, id: courseId },
			paidAt: { gte: from, lte: to },
		},
		orderBy: { paidAt: "desc" },
		include: { course: { select: { title: true } } },
	});
	const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
	const refunded = charges.filter((c) => c.status === "refunded");
	res.json({
		salesCount: charges.length,
		salesCents: sum(charges.map((c) => c.amountCents)),
		refundsCount: refunded.length,
		refundsCents: sum(refunded.map((c) => c.amountCents)),
		// After provider costs, of charges not refunded. A charge whose webhook gave no net amount counts 0.
		receivedCents: sum(
			charges.filter((c) => c.status === "paid").map((c) => c.netCents ?? 0),
		),
		charges: charges.map((c) => ({
			id: c.id,
			courseId: c.courseId,
			courseTitle: c.course.title,
			amountCents: c.amountCents,
			netCents: c.netCents,
			status: c.status,
			paidAt: c.paidAt,
			refundedAt: c.refundedAt,
		})),
	});
});

/** Everyone who holds a subscription to the caller's courses, with completion percentage. */
dashboardRouter.get("/subscribers", async (req, res) => {
	const f = filterSchema.pick({ courseId: true }).safeParse(req.query);
	if (!f.success) {
		res.status(400).json({ error: "invalid_input" });
		return;
	}
	const subs = await db.subscription.findMany({
		where: { course: { ownerId: req.user!.id, id: f.data.courseId } },
		orderBy: { createdAt: "desc" },
		include: {
			user: { select: { id: true, username: true, email: true } },
			plan: { select: { months: true } },
			course: { select: { title: true } },
		},
	});
	res.json(
		await Promise.all(
			subs.map(async (s) => ({
				subscriptionId: s.id,
				courseId: s.courseId,
				courseTitle: s.course.title,
				user: s.user,
				planMonths: s.plan?.months ?? null,
				expiresAt: s.expiresAt,
				canceledAt: s.canceledAt,
				percent: (await courseProgress(s.userId, s.courseId)).percent,
			})),
		),
	);
});
