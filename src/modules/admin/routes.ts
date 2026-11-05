import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";

/** Mounted behind `requireRole("admin")`. */
export const adminRouter = Router();

adminRouter.put("/courses/:id/featured", async (req, res) => {
	const input = z.object({ featured: z.boolean() }).safeParse(req.body);
	if (!input.success) {
		res.status(400).json({ error: "invalid_input" });
		return;
	}
	const { count } = await db.course.updateMany({
		where: { id: req.params.id },
		data: { featured: input.data.featured },
	});
	res.status(count ? 204 : 404).end();
});

adminRouter.get("/courses", async (_req, res) => {
	res.json(
		await db.course.findMany({
			orderBy: { createdAt: "desc" },
			include: { owner: { select: { username: true } } },
		}),
	);
});

const publicUser = {
	id: true,
	email: true,
	username: true,
	role: true,
	suspendedAt: true,
	createdAt: true,
} as const;

/** `?q=` matches email or username; `?role=` narrows to creators, users or admins. */
adminRouter.get("/users", async (req, res) => {
	const q = typeof req.query.q === "string" ? req.query.q : "";
	const role = z.enum(["user", "creator", "admin"]).safeParse(req.query.role);
	res.json(
		await db.user.findMany({
			where: {
				...(role.success && { role: role.data }),
				OR: [
					{ email: { contains: q, mode: "insensitive" } },
					{ username: { contains: q, mode: "insensitive" } },
				],
			},
			select: publicUser,
			orderBy: { createdAt: "desc" },
			take: 100,
		}),
	);
});

/** Admins can't lock themselves out: self-targeting changes are refused. */
async function updateUser(
	req: import("express").Request,
	res: import("express").Response,
	data: { suspendedAt?: Date | null; role?: "user" | "creator" | "admin" },
) {
	const id = String(req.params.id);
	if (id === req.user!.id) {
		res.status(400).json({ error: "cannot_modify_self" });
		return;
	}
	const { count } = await db.user.updateMany({ where: { id }, data });
	if (count && data.suspendedAt)
		await db.session.deleteMany({ where: { userId: id } });
	res.status(count ? 204 : 404).end();
}

adminRouter.post("/users/:id/suspend", (req, res) =>
	updateUser(req, res, { suspendedAt: new Date() }),
);
adminRouter.post("/users/:id/restore", (req, res) =>
	updateUser(req, res, { suspendedAt: null }),
);
adminRouter.put("/users/:id/role", (req, res) => {
	const input = z
		.object({ role: z.enum(["user", "creator", "admin"]) })
		.safeParse(req.body);
	if (!input.success) {
		res.status(400).json({ error: "invalid_input" });
		return;
	}
	return updateUser(req, res, { role: input.data.role });
});
