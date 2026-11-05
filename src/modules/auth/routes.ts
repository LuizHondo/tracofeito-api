import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import type { User } from "../../generated/prisma/client.ts";
import type { Mailer } from "../../providers/email.ts";
import { requireAuth } from "./guards.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { endSession, startSession } from "./session.ts";
import { consumeToken, createToken } from "./tokens.ts";

export const signUpSchema = z.object({
	email: z.email().transform((e) => e.toLowerCase()),
	username: z
		.string()
		.regex(/^[a-zA-Z0-9_]{3,30}$/, "3-30 letters, digits or underscore"),
	bio: z.string().max(500).default(""),
	password: z.string().min(8).max(200),
});

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
// ponytail: in-memory per-process counter, move to the DB/Redis with multiple API instances
const failures = new Map<string, { count: number; resetAt: number }>();
const DUMMY_HASH = await hashPassword("dummy"); // equalizes timing for unknown accounts

const webUrl = () => process.env.WEB_URL ?? "http://localhost:3000";

export function createAuthRouter(mailer: Mailer) {
	const authRouter = Router();

	async function sendVerification(user: { id: string; email: string }) {
		const token = await createToken(user.id, "verify_email");
		await mailer.send({
			to: user.email,
			subject: "Confirme seu email",
			text: `Confirme seu email: ${webUrl()}/verify-email?token=${token}`,
		});
	}

	authRouter.post("/sign-up", async (req, res) => {
		const parsed = signUpSchema.safeParse(req.body);
		if (!parsed.success) {
			res
				.status(400)
				.json({ error: "invalid_input", issues: parsed.error.issues });
			return;
		}
		const { password, ...data } = parsed.data;
		const taken = await db.user.findFirst({
			where: {
				OR: [
					{ email: data.email },
					{ username: { equals: data.username, mode: "insensitive" } },
				],
			},
			select: { email: true },
		});
		if (taken) {
			res.status(409).json({
				error: taken.email === data.email ? "email_taken" : "username_taken",
			});
			return;
		}
		const user = await db.user.create({
			data: { ...data, passwordHash: await hashPassword(password) },
			select: { id: true, email: true, username: true, bio: true, role: true },
		});
		await sendVerification(user);
		res.status(201).json(user);
	});

	const signInSchema = z.object({
		login: z.string().min(1),
		password: z.string().min(1),
	});

	authRouter.post("/sign-in", async (req, res) => {
		const parsed = signInSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({ error: "invalid_input" });
			return;
		}
		const key = req.ip ?? "unknown";
		const f = failures.get(key);
		if (f && f.resetAt > Date.now() && f.count >= MAX_FAILURES) {
			res.status(429).json({ error: "too_many_attempts" });
			return;
		}
		const { login, password } = parsed.data;
		const user = await db.user.findFirst({
			where: {
				OR: [
					{ email: login.toLowerCase() },
					{ username: { equals: login, mode: "insensitive" } },
				],
			},
		});
		const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
		if (!user || !ok || user.suspendedAt) {
			const cur =
				f && f.resetAt > Date.now()
					? f
					: { count: 0, resetAt: Date.now() + WINDOW_MS };
			cur.count++;
			failures.set(key, cur);
			res.status(401).json({ error: "invalid_credentials" });
			return;
		}
		failures.delete(key);
		await startSession(res, user.id);
		res.json({
			id: user.id,
			email: user.email,
			username: user.username,
			bio: user.bio,
			role: user.role,
		});
	});

	authRouter.post("/sign-out", async (req, res) => {
		await endSession(req, res);
		res.status(204).end();
	});

	const publicUser = ({
		id,
		email,
		username,
		bio,
		role,
		emailVerified,
	}: User) => ({
		id,
		email,
		username,
		bio,
		role,
		emailVerified,
	});

	authRouter.get("/me", requireAuth, (req, res) => {
		res.json(publicUser(req.user as User));
	});

	const profileSchema = z.object({
		username: signUpSchema.shape.username.optional(),
		bio: signUpSchema.shape.bio.optional(),
		newPassword: signUpSchema.shape.password.optional(),
		currentPassword: z.string().optional(),
	});

	authRouter.patch("/me", requireAuth, async (req, res) => {
		const me = req.user as User;
		const parsed = profileSchema.safeParse(req.body);
		if (!parsed.success) {
			res
				.status(400)
				.json({ error: "invalid_input", issues: parsed.error.issues });
			return;
		}
		const { username, bio, newPassword, currentPassword } = parsed.data;
		if (
			newPassword &&
			!(
				currentPassword &&
				(await verifyPassword(currentPassword, me.passwordHash))
			)
		) {
			res.status(403).json({ error: "wrong_current_password" });
			return;
		}
		if (username && username.toLowerCase() !== me.username.toLowerCase()) {
			const taken = await db.user.findFirst({
				where: { username: { equals: username, mode: "insensitive" } },
			});
			if (taken) {
				res.status(409).json({ error: "username_taken" });
				return;
			}
		}
		const updated = await db.user.update({
			where: { id: me.id },
			data: {
				username,
				bio,
				passwordHash: newPassword ? await hashPassword(newPassword) : undefined,
			},
		});
		res.json(publicUser(updated));
	});

	authRouter.post("/verify-email", async (req, res) => {
		const token = z.string().safeParse(req.body?.token);
		const userId = token.success
			? await consumeToken(token.data, "verify_email")
			: null;
		if (!userId) {
			res.status(400).json({ error: "invalid_or_expired_token" });
			return;
		}
		await db.user.update({
			where: { id: userId },
			data: { emailVerified: true },
		});
		res.status(204).end();
	});

	authRouter.post("/resend-verification", async (req, res) => {
		if (!req.user) {
			res.status(401).json({ error: "unauthenticated" });
			return;
		}
		if (!req.user.emailVerified) await sendVerification(req.user);
		res.status(204).end();
	});

	authRouter.post("/forgot-password", async (req, res) => {
		const email = z.email().safeParse(req.body?.email);
		if (email.success) {
			const user = await db.user.findUnique({
				where: { email: email.data.toLowerCase() },
			});
			if (user?.emailVerified) {
				const token = await createToken(user.id, "reset_password");
				await mailer.send({
					to: user.email,
					subject: "Redefinir senha",
					text: `Redefina sua senha (válido por 1 hora): ${webUrl()}/reset-password?token=${token}`,
				});
			}
		}
		res.status(204).end(); // same answer whether or not the account exists
	});

	authRouter.post("/reset-password", async (req, res) => {
		const parsed = z
			.object({ token: z.string(), password: signUpSchema.shape.password })
			.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({ error: "invalid_input" });
			return;
		}
		const userId = await consumeToken(parsed.data.token, "reset_password");
		if (!userId) {
			res.status(400).json({ error: "invalid_or_expired_token" });
			return;
		}
		await db.user.update({
			where: { id: userId },
			data: { passwordHash: await hashPassword(parsed.data.password) },
		});
		await db.session.deleteMany({ where: { userId } });
		res.status(204).end();
	});

	return authRouter;
}
