import { planTotalCents } from "../../shared/index.ts";
import { Router } from "express";
import { db } from "../../db.ts";
import type { VideoHost } from "../../providers/video.ts";
import { requireAuth } from "../auth/guards.ts";
import { memberProgressRouter } from "../progress/routes.ts";
import { hasAccess } from "../subscriptions/access.ts";
import { createPlaybackRouter } from "../videos/routes.ts";

const ownerSelect = {
	owner: { select: { username: true, bio: true } },
} as const;

/** Pages in sidebar order: depth-first, siblings by position. */
function treeOrder<
	T extends { id: string; parentId: string | null; position: number },
>(pages: T[]): T[] {
	const out: T[] = [];
	const walk = (parentId: string | null) => {
		for (const p of pages
			.filter((x) => x.parentId === parentId)
			.sort((a, b) => a.position - b.position)) {
			out.push(p);
			walk(p.id);
		}
	};
	walk(null);
	return out;
}

export function createContentRouter(video: () => VideoHost) {
	const contentRouter = Router();

	/** Public selling page: only published courses, no auth. */
	contentRouter.get("/:courseId/selling", async (req, res) => {
		const course = await db.course.findFirst({
			where: { id: req.params.courseId, published: true },
			include: ownerSelect,
		});
		if (!course) {
			res.status(404).json({ error: "not_found" });
			return;
		}
		const [blocks, plans] = await Promise.all([
			db.block.findMany({
				where: { courseId: course.id, pageId: null },
				orderBy: { position: "asc" },
			}),
			db.plan.findMany({
				where: { courseId: course.id },
				orderBy: { months: "asc" },
			}),
		]);
		res.json({
			course,
			blocks,
			plans: plans.map((p) => ({
				...p,
				priceCents: planTotalCents(course.baseMonthlyCents, p),
			})),
		});
	});

	// Members area: sign-in required, then hasAccess.
	contentRouter.use(requireAuth);
	contentRouter.use("/:courseId", async (req, res, next) => {
		const course = await db.course.findUnique({
			where: { id: req.params.courseId },
		});
		if (!course) {
			res.status(404).json({ error: "not_found" });
			return;
		}
		if (!(await hasAccess(req.user as NonNullable<typeof req.user>, course))) {
			res.status(403).json({ error: "no_access" });
			return;
		}
		res.locals.course = course;
		next();
	});

	contentRouter.get("/:courseId/pages", async (_req, res) => {
		res.json(
			treeOrder(
				await db.page.findMany({ where: { courseId: res.locals.course.id } }),
			),
		);
	});

	contentRouter.get("/:courseId/pages/:pageId", async (req, res) => {
		const pages = treeOrder(
			await db.page.findMany({ where: { courseId: res.locals.course.id } }),
		);
		const i = pages.findIndex((p) => p.id === req.params.pageId);
		if (i < 0) {
			res.status(404).json({ error: "not_found" });
			return;
		}
		res.json({
			page: pages[i],
			blocks: await db.block.findMany({
				where: { pageId: pages[i]?.id },
				orderBy: { position: "asc" },
			}),
			prevId: pages[i - 1]?.id ?? null,
			nextId: pages[i + 1]?.id ?? null,
		});
	});

	contentRouter.use(createPlaybackRouter(video));
	contentRouter.use(memberProgressRouter);
	return contentRouter;
}
