import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db } from "../../db.ts";

const COOKIE = "sid";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const sha256 = (s: string) =>
	createHash("sha256").update(s).digest("hex");

function readCookie(req: Request, name: string): string | undefined {
	for (const part of (req.headers.cookie ?? "").split(";")) {
		const [k, ...v] = part.trim().split("=");
		if (k === name) return decodeURIComponent(v.join("="));
	}
}

const cookieOpts = {
	httpOnly: true,
	sameSite: "lax",
	secure: process.env.NODE_ENV === "production",
	domain: process.env.COOKIE_DOMAIN || undefined, // shared parent domain in production
	path: "/",
} as const;

export async function startSession(res: Response, userId: string) {
	const value = randomBytes(32).toString("base64url");
	await db.session.create({
		data: {
			id: sha256(value),
			userId,
			expiresAt: new Date(Date.now() + TTL_MS),
		},
	});
	res.cookie(COOKIE, value, { ...cookieOpts, maxAge: TTL_MS });
}

export async function endSession(req: Request, res: Response) {
	const value = readCookie(req, COOKIE);
	if (value) await db.session.deleteMany({ where: { id: sha256(value) } });
	res.clearCookie(COOKIE, cookieOpts);
}

/** Sets req.user when a valid session cookie is present; never rejects. */
export async function loadUser(
	req: Request,
	_res: Response,
	next: NextFunction,
) {
	const value = readCookie(req, COOKIE);
	if (value) {
		const session = await db.session.findUnique({
			where: { id: sha256(value) },
			include: { user: true },
		});
		if (session && session.expiresAt > new Date() && !session.user.suspendedAt)
			req.user = session.user;
	}
	next();
}
