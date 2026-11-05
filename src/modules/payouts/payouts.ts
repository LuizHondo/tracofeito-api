import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import type { User } from "../../generated/prisma/client.ts";
import type { PaymentProvider } from "../../providers/payment.ts";

// The provider requires a declared income; we no longer ask creators for it.
// ponytail: fixed placeholder, collect the real value again if the provider starts verifying it
const DEFAULT_INCOME_CENTS = 500000;

/** What the provider needs to open a sub-account (the user's email is added server-side). */
export const payoutInfoSchema = z.strictObject({
	name: z.string().min(1).max(200),
	cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/),
	mobilePhone: z.string().regex(/^\d{10,11}$/),
	postalCode: z.string().regex(/^\d{8}$/),
	addressNumber: z.string().min(1).max(20),
	birthDate: z.iso.date().optional(), // required by the provider for individuals
});

export type PayoutStatus = "none" | "pending" | "enabled";

/** The payment provider the app was created with (see `createApp`). */
export const paymentsOf = (req: Request) =>
	(req.app.locals.payments as () => PaymentProvider)();

/**
 * Starts payout onboarding on the creator's first call. Returns false when
 * there is no payout account yet and no details to open one with.
 */
export async function ensurePayoutAccount(
	payments: PaymentProvider,
	user: Pick<User, "id" | "email">,
	info?: z.infer<typeof payoutInfoSchema>,
) {
	if (await db.creatorProfile.findUnique({ where: { userId: user.id } }))
		return true;
	if (!info) return false;
	const account = await payments.createPayoutAccount({
		...info,
		incomeValueCents: DEFAULT_INCOME_CENTS,
		email: user.email,
	});
	// ponytail: two simultaneous first calls open two provider accounts; add a lock if that bites
	await db.creatorProfile.create({ data: { userId: user.id, ...account } });
	return true;
}

/** Status shown to the creator; asks the provider while payouts aren't enabled yet. */
export async function payoutStatus(
	payments: PaymentProvider,
	userId: string,
): Promise<PayoutStatus> {
	const profile = await db.creatorProfile.findUnique({ where: { userId } });
	if (!profile) return "none";
	if (profile.payoutEnabled) return "enabled";
	if (!(await payments.isPayoutEnabled(profile))) return "pending";
	await db.creatorProfile.update({
		where: { userId },
		data: { payoutEnabled: true },
	});
	return "enabled";
}

/** Purchases of a creator's courses are allowed only once payouts are enabled. */
export async function isSellable(payments: PaymentProvider, ownerId: string) {
	return (await payoutStatus(payments, ownerId)) === "enabled";
}

export const payoutsRouter = Router();
payoutsRouter.get("/status", async (req, res) => {
	res.json({ status: await payoutStatus(paymentsOf(req), req.user!.id) });
});
payoutsRouter.post("/", async (req, res) => {
	const parsed = payoutInfoSchema.safeParse(req.body);
	if (!parsed.success) {
		res
			.status(400)
			.json({ error: "invalid_input", issues: parsed.error.issues });
		return;
	}
	try {
		await ensurePayoutAccount(paymentsOf(req), req.user!, parsed.data);
	} catch (err) {
		console.error("payout onboarding failed", err);
		res.status(502).json({ error: "payout_onboarding_failed" });
		return;
	}
	res
		.status(201)
		.json({ status: await payoutStatus(paymentsOf(req), req.user!.id) });
});
