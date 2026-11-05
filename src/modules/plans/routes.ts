import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import { loadOwnedCourse } from "../courses/routes.ts";

const recurring = z.strictObject({
	months: z.int().min(1).max(12),
	discountPercent: z.int().min(0).max(100).default(0),
});
const lifetime = z.strictObject({
	months: z.null(),
	lifetimeCents: z.int().min(1),
});
const createSchema = z.union([recurring, lifetime]);
const updateSchema = z.strictObject({
	discountPercent: z.int().min(0).max(100).optional(),
	lifetimeCents: z.int().min(1).optional(),
});

export const plansRouter = Router({ mergeParams: true });

plansRouter.get("/", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	res.json(
		await db.plan.findMany({
			where: { courseId: course.id },
			orderBy: { months: "asc" },
		}),
	);
});

plansRouter.post("/", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	const parsed = createSchema.safeParse(req.body);
	if (!parsed.success) {
		res
			.status(400)
			.json({ error: "invalid_input", issues: parsed.error.issues });
		return;
	}
	const duplicate = await db.plan.findFirst({
		where: { courseId: course.id, months: parsed.data.months },
	});
	if (duplicate) {
		res.status(409).json({ error: "plan_length_taken" });
		return;
	}
	res
		.status(201)
		.json(
			await db.plan.create({ data: { ...parsed.data, courseId: course.id } }),
		);
});

/** Price and discount changes apply to new charges only; existing access is untouched. */
plansRouter.patch("/:planId", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	const plan = await db.plan.findFirst({
		where: { id: String(req.params.planId), courseId: course.id },
	});
	const parsed = updateSchema.safeParse(req.body);
	if (!plan) {
		res.status(404).json({ error: "not_found" });
		return;
	}
	if (
		!parsed.success ||
		(plan.months === null && parsed.data.discountPercent !== undefined) ||
		(plan.months !== null && parsed.data.lifetimeCents !== undefined)
	) {
		res.status(400).json({ error: "invalid_input" });
		return;
	}
	res.json(await db.plan.update({ where: { id: plan.id }, data: parsed.data }));
});

plansRouter.delete("/:planId", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	const { count } = await db.plan.deleteMany({
		where: { id: String(req.params.planId), courseId: course.id },
	});
	res.status(count ? 204 : 404).end();
});
