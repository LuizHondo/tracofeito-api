import { Router } from "express";
import { db } from "../../db.ts";
import { loadOwnedCourse } from "../courses/routes.ts";

/** Completed pages / total pages of the course as it is now. Ignores access, so it survives expiry. */
export async function courseProgress(userId: string, courseId: string) {
	const [total, done] = await Promise.all([
		db.page.count({ where: { courseId } }),
		db.pageProgress.findMany({
			where: { userId, page: { courseId } },
			select: { pageId: true },
		}),
	]);
	return {
		completedPageIds: done.map((d) => d.pageId),
		total,
		percent: total ? Math.round((done.length / total) * 100) : 0,
	};
}

/** Member side, mounted under `/content/:courseId` after the `hasAccess` gate. */
export const memberProgressRouter = Router();

memberProgressRouter.get("/:courseId/progress", async (req, res) => {
	res.json(await courseProgress(req.user?.id ?? "", res.locals.course.id));
});

for (const method of ["put", "delete"] as const) {
	memberProgressRouter[method](
		"/:courseId/pages/:pageId/complete",
		async (req, res) => {
			const key = {
				userId: req.user?.id ?? "",
				pageId: String(req.params.pageId),
			};
			if (
				!(await db.page.findFirst({
					where: { id: key.pageId, courseId: res.locals.course.id },
				}))
			) {
				res.status(404).json({ error: "not_found" });
				return;
			}
			if (method === "put")
				await db.pageProgress.upsert({
					where: { userId_pageId: key },
					create: key,
					update: {},
				});
			else await db.pageProgress.deleteMany({ where: key });
			res.json(await courseProgress(key.userId, res.locals.course.id));
		},
	);
}

/** Creator/admin view of one user's progress, at `/courses/:id/progress/:userId`. */
export const courseProgressRouter = Router({ mergeParams: true });

courseProgressRouter.get("/:userId", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (course)
		res.json(await courseProgress(String(req.params.userId), course.id));
});
