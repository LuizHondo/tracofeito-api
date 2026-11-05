import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import {
	isOwnerOrAdmin,
	requireAuth,
	requireRole,
	requireVerified,
} from "../auth/guards.ts";
import { couponsRouter } from "../coupons/routes.ts";
import { blocksRouter } from "../pages/blocks.ts";
import { pagesRouter } from "../pages/routes.ts";
import {} from "../payouts/payouts.ts";
import { plansRouter } from "../plans/routes.ts";

const courseInput = z.strictObject({
	title: z.string().min(1).max(200),
	description: z.string().max(5000),
	coverUrl: z.url().nullable(),
	baseMonthlyCents: z.int().min(0),
	paymentType: z.enum(["subscription", "one_time"]),
	published: z.boolean(),
});
const createSchema = courseInput
	.partial()
	.required({ title: true, baseMonthlyCents: true });
const updateSchema = courseInput.partial();

const withOwner = { owner: { select: { username: true, bio: true } } } as const;
/** Studio list counts; `blocks` counts only the selling page's blocks (pageId null). */
const withCounts = {
	_count: {
		select: { plans: true, pages: true, blocks: { where: { pageId: null } } },
	},
} as const;

export const coursesRouter = Router();
coursesRouter.use(requireAuth);
coursesRouter.use("/:id/plans", plansRouter);
coursesRouter.use("/:id/coupons", couponsRouter);
coursesRouter.use("/:id/pages", pagesRouter);
coursesRouter.use("/:id/blocks", blocksRouter);

coursesRouter.post(
	"/",
	requireRole("creator", "admin"),
	requireVerified,
	async (req, res) => {
		const parsed = createSchema.safeParse(req.body);
		if (!parsed.success) {
			res
				.status(400)
				.json({ error: "invalid_input", issues: parsed.error.issues });
			return;
		}
		const course = await db.course.create({
			data: { ...parsed.data, ownerId: req.user!.id },
			include: withOwner,
		});
		res.status(201).json(course);
	},
);

coursesRouter.get(
	"/mine",
	requireRole("creator", "admin"),
	async (req, res) => {
		res.json(
			await db.course.findMany({
				where: { ownerId: req.user!.id },
				orderBy: { createdAt: "desc" },
				include: { ...withOwner, ...withCounts },
			}),
		);
	},
);

/** Loads the course and answers 404/403 itself; returns null when it did. */
export async function loadOwnedCourse(
	req: import("express").Request,
	res: import("express").Response,
) {
	const course = await db.course.findUnique({
		where: { id: String(req.params.id) },
		include: withOwner,
	});
	if (!course) {
		res.status(404).json({ error: "not_found" });
		return null;
	}
	if (!isOwnerOrAdmin(req.user!, course.ownerId)) {
		res.status(403).json({ error: "forbidden" });
		return null;
	}
	return course;
}

coursesRouter.get("/:id", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (course) res.json(course);
});

coursesRouter.patch("/:id", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	const parsed = updateSchema.safeParse(req.body);
	if (!parsed.success) {
		res
			.status(400)
			.json({ error: "invalid_input", issues: parsed.error.issues });
		return;
	}
	res.json(
		await db.course.update({
			where: { id: course.id },
			data: parsed.data,
			include: withOwner,
		}),
	);
});

// Deleting removes paid access, so it stays admin-only (see .TODO assumptions).
coursesRouter.delete("/:id", requireRole("admin"), async (req, res) => {
	const { count } = await db.course.deleteMany({
		where: { id: String(req.params.id) },
	});
	res.status(count ? 204 : 404).end();
});
