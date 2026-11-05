import express from "express";
import { adminRouter } from "./modules/admin/routes.ts";
import { requireAuth, requireRole } from "./modules/auth/guards.ts";
import { createAuthRouter } from "./modules/auth/routes.ts";
import { loadUser } from "./modules/auth/session.ts";
import { catalogRouter } from "./modules/catalog/routes.ts";
import { createContentRouter } from "./modules/content/routes.ts";
import { coursesRouter } from "./modules/courses/routes.ts";
import { dashboardRouter } from "./modules/dashboard/routes.ts";
import { payoutsRouter } from "./modules/payouts/payouts.ts";
import { courseProgressRouter } from "./modules/progress/routes.ts";
import { mySubscriptionsRouter } from "./modules/subscriptions/mine.ts";
import { refundsRouter } from "./modules/subscriptions/refunds.ts";
import { purchaseRouter, renewRouter } from "./modules/subscriptions/routes.ts";
import { createPaymentWebhook } from "./modules/subscriptions/webhook.ts";
import {
	createVideosRouter,
	createVideoWebhook,
} from "./modules/videos/routes.ts";
import { type Mailer, mailerFromEnv } from "./providers/email.ts";
import {
	type PaymentProvider,
	paymentProviderFromEnv,
} from "./providers/payment.ts";
import { type VideoHost, videoHostFromEnv } from "./providers/video.ts";

export function createApp(
	mailer: Mailer = mailerFromEnv(),
	video: () => VideoHost = videoHostFromEnv,
	payments: () => PaymentProvider = paymentProviderFromEnv,
) {
	const app = express();
	app.locals.payments = payments;
	app.use(express.json());
	app.get("/health", (_req, res) => {
		res.json({ ok: true });
	});
	app.use("/catalog", catalogRouter);
	app.use("/webhooks/video", createVideoWebhook(video));
	app.use("/webhooks/payments", createPaymentWebhook(payments));
	app.use(loadUser);
	app.use("/auth", createAuthRouter(mailer));
	app.use("/admin", requireAuth, requireRole("admin"), adminRouter);
	app.use(
		"/payouts",
		requireAuth,
		requireRole("creator", "admin"),
		payoutsRouter,
	);
	app.use("/courses/:id/videos", requireAuth, createVideosRouter(video));
	app.use(
		"/dashboard",
		requireAuth,
		requireRole("creator", "admin"),
		dashboardRouter,
	);
	app.use("/charges", requireAuth, refundsRouter);
	app.use("/subscriptions", requireAuth, mySubscriptionsRouter);
	app.use("/courses/:id/purchase", requireAuth, purchaseRouter);
	app.use("/courses/:id/renew", requireAuth, renewRouter);
	app.use("/courses/:id/progress", requireAuth, courseProgressRouter);
	app.use("/courses", coursesRouter);
	app.use("/content", createContentRouter(video));
	return app;
}
