import { Router } from "express";
import type { PaymentProvider } from "../../providers/payment.ts";
import { confirmCharge, confirmRefund } from "./subscriptions.ts";

/** Payment provider webhook, mounted at `/webhooks/payments` (no session auth; the provider token is checked). */
export function createPaymentWebhook(payments: () => PaymentProvider) {
	const router = Router();
	router.post("/", async (req, res) => {
		const event = payments().parseWebhook(req.headers, req.body);
		if (!event) {
			res.status(400).json({ error: "invalid_webhook" });
			return;
		}
		const now = new Date();
		if (event.type === "paid")
			await confirmCharge(event.chargeId, now, event.eventId, event.netCents);
		else await confirmRefund(event.chargeId, now, event.eventId);
		res.status(204).end();
	});
	return router;
}
