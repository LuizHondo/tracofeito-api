import type { NextFunction, Request, Response } from "express";
import type { Role, User } from "../../generated/prisma/client.ts";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
	if (!req.user) {
		res.status(401).json({ error: "unauthenticated" });
		return;
	}
	next();
}

export const requireRole =
	(...roles: Role[]) =>
	(req: Request, res: Response, next: NextFunction) => {
		if (!req.user) {
			res.status(401).json({ error: "unauthenticated" });
			return;
		}
		if (!roles.includes(req.user.role)) {
			res.status(403).json({ error: "forbidden" });
			return;
		}
		next();
	};

/** Purchasing and creating courses need a verified email. */
export function requireVerified(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (!req.user) {
		res.status(401).json({ error: "unauthenticated" });
		return;
	}
	if (!req.user.emailVerified) {
		res.status(403).json({ error: "email_not_verified" });
		return;
	}
	next();
}

/** Ownership rule shared by courses and user data: the owner or an admin. */
export const isOwnerOrAdmin = (
	user: Pick<User, "id" | "role">,
	ownerId: string,
) => user.role === "admin" || user.id === ownerId;
