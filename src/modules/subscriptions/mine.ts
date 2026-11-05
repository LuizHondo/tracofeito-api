import { Router } from "express";
import { db } from "../../db.ts";

const EXPIRING_DAYS = 7;

export type Warning = "expiring" | "expired" | null;

/** In-app warning: shown for expired subscriptions and ones inside the renewal window. */
export function warningFor(expiresAt: Date | null, now = new Date()): Warning {
	if (!expiresAt) return null;
	if (expiresAt <= now) return "expired";
	return expiresAt.getTime() - now.getTime() <= EXPIRING_DAYS * 864e5
		? "expiring"
		: null;
}

/** The signed-in user's own subscriptions, mounted at `/subscriptions` behind `requireAuth`. */
export const mySubscriptionsRouter = Router();

mySubscriptionsRouter.get("/", async (req, res) => {
	const subs = await db.subscription.findMany({
		where: { userId: req.user!.id },
		orderBy: { createdAt: "desc" },
		include: {
			course: { select: { id: true, title: true } },
			charges: {
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					amountCents: true,
					status: true,
					months: true,
					url: true,
					dueAt: true,
					paidAt: true,
					refundedAt: true,
					createdAt: true,
				},
			},
		},
	});
	res.json(
		subs.map(({ userId: _u, ...sub }) => ({
			...sub,
			// canceled renewals still end at `expiresAt`, so warn either way
			warning: warningFor(sub.expiresAt),
		})),
	);
});

/** Stops renewal charges; access continues until `expiresAt`. */
mySubscriptionsRouter.post("/:id/cancel", async (req, res) => {
	const { count } = await db.subscription.updateMany({
		where: { id: String(req.params.id), userId: req.user!.id },
		data: { canceledAt: new Date() },
	});
	res.status(count ? 204 : 404).end();
});
