import cron from "node-cron";
import { db } from "../db.ts";
import { openCharge } from "../modules/subscriptions/routes.ts";
import { expireStaleCharges } from "../modules/subscriptions/subscriptions.ts";
import type { Mailer } from "../providers/email.ts";
import type { PaymentProvider } from "../providers/payment.ts";

const WINDOW_DAYS = 7;

/**
 * Creates the renewal charge and emails the link for every non-canceled
 * recurring subscription that expires within the window and has no pending
 * charge. Returns how many were created; a failure on one subscription is
 * logged and retried on the next run.
 */
export async function createRenewalCharges(
	payments: PaymentProvider,
	mailer: Mailer,
	now = new Date(),
) {
	await expireStaleCharges(now);
	const due = await db.subscription.findMany({
		where: {
			canceledAt: null,
			planId: { not: null },
			expiresAt: {
				gt: now,
				lte: new Date(now.getTime() + WINDOW_DAYS * 864e5),
			},
			charges: { none: { status: "pending" } },
		},
		include: { user: true, course: true },
	});
	let created = 0;
	for (const sub of due) {
		try {
			const out = await openCharge(payments, sub.user, {
				courseId: sub.courseId,
				planId: sub.planId!,
				subscriptionId: sub.id,
			});
			if (!("charge" in out)) {
				console.error(`renewal skipped for ${sub.id}: ${out.error}`);
				continue;
			}
			await mailer.send({
				to: sub.user.email,
				subject: `Renove seu acesso a ${sub.course.title}`,
				text: `Seu acesso a "${sub.course.title}" expira em ${sub.expiresAt!.toLocaleDateString("pt-BR")}.\nPague para renovar: ${out.charge.url}`,
			});
			created++;
		} catch (err) {
			console.error(`renewal failed for ${sub.id}`, err);
		}
	}
	return created;
}

// ponytail: in-process cron assumes a single API instance; move to a job queue (pg-boss) before scaling out
export function startRenewalJob(
	payments: () => PaymentProvider,
	mailer: Mailer,
) {
	return cron.schedule("0 * * * *", () => {
		createRenewalCharges(payments(), mailer).catch((err) =>
			console.error("renewal job failed", err),
		);
	});
}
