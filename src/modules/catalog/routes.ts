import { planTotalCents } from "../../shared/index.ts";
import { Router } from "express";
import { db } from "../../db.ts";

export const catalogRouter = Router();

/**
 * Public gallery: published courses that have at least one plan.
 * ponytail: not yet filtered by creator payout enabled (task 7.3).
 */
catalogRouter.get("/", async (_req, res) => {
	const courses = await db.course.findMany({
		where: { published: true, plans: { some: {} } },
		include: {
			plans: true,
			owner: { select: { username: true } },
		},
		orderBy: { createdAt: "desc" },
	});
	const cards = courses.map(({ plans, ...c }) => ({
		id: c.id,
		title: c.title,
		coverUrl: c.coverUrl,
		creator: c.owner.username,
		featured: c.featured,
		startingPriceCents: Math.min(
			...plans.map((p) => planTotalCents(c.baseMonthlyCents, p)),
		),
	}));
	res.json({
		featured: cards.filter((c) => c.featured),
		courses: cards,
	});
});
