import { Router } from "express";
import { db } from "../../db.ts";
import { isOwnerOrAdmin } from "../auth/guards.ts";
import { paymentsOf } from "../payouts/payouts.ts";

/**
 * Mounted at `/charges` behind `requireAuth`. Creators refund charges of their
 * own courses, admins any. The provider is asked here; access is rolled back
 * when its refund webhook arrives (`confirmRefund`).
 */
export const refundsRouter = Router();

refundsRouter.post("/:id/refund", async (req, res) => {
	const charge = await db.charge.findUnique({
		where: { id: String(req.params.id) },
		include: { course: { select: { ownerId: true } } },
	});
	if (!charge) {
		res.status(404).json({ error: "not_found" });
		return;
	}
	if (!isOwnerOrAdmin(req.user!, charge.course.ownerId)) {
		res.status(403).json({ error: "forbidden" });
		return;
	}
	if (charge.status !== "paid") {
		res.status(409).json({ error: "not_refundable" });
		return;
	}
	try {
		await paymentsOf(req).refund(charge.providerId);
	} catch (err) {
		// e.g. Asaas cannot refund boleto charges, only card and Pix
		console.error("refund failed", err);
		res.status(502).json({ error: "refund_failed" });
		return;
	}
	res.status(202).json({ status: "refund_requested" });
});
