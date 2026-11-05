import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import { loadOwnedCourse } from "../courses/routes.ts";
import { blocksRouter } from "./blocks.ts";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const createSchema = z.strictObject({
	title: z.string().trim().min(1).max(200),
	slug,
	parentId: z.uuid().nullable().default(null),
	position: z.int().min(0).optional(),
});
const updateSchema = createSchema.partial();

export const pagesRouter = Router({ mergeParams: true });
pagesRouter.use("/:pageId/blocks", blocksRouter);

const bad = (res: import("express").Response, error: string, status = 400) =>
	res.status(status).json({ error });

/** Flat list in sibling order; clients build the tree from `parentId`. */
pagesRouter.get("/", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	res.json(
		await db.page.findMany({
			where: { courseId: course.id },
			orderBy: [{ parentId: "asc" }, { position: "asc" }],
		}),
	);
});

pagesRouter.post("/", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	const parsed = createSchema.safeParse(req.body);
	if (!parsed.success) return bad(res, "invalid_input");
	const { position, ...data } = parsed.data;
	await placePage(course.id, null, data, position, res);
});

pagesRouter.patch("/:pageId", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	const page = await db.page.findFirst({
		where: { id: String(req.params.pageId), courseId: course.id },
	});
	if (!page) return bad(res, "not_found", 404);
	const parsed = updateSchema.safeParse(req.body);
	if (!parsed.success) return bad(res, "invalid_input");
	const { position, ...rest } = parsed.data;
	await placePage(
		course.id,
		page,
		{
			title: rest.title ?? page.title,
			slug: rest.slug ?? page.slug,
			parentId: rest.parentId === undefined ? page.parentId : rest.parentId,
		},
		position,
		res,
	);
});

pagesRouter.delete("/:pageId", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	const { count } = await db.page.deleteMany({
		where: { id: String(req.params.pageId), courseId: course.id },
	});
	res.status(count ? 204 : 404).end();
});

/**
 * Creates (`page` null) or updates a page and renumbers its new siblings so
 * positions stay 0..n-1. Validates parent ownership, cycles and slug uniqueness
 * among siblings (SQL treats null parents as distinct, so it is checked here).
 * ponytail: check-then-write, a concurrent duplicate slug could slip in; add a
 * partial unique index if editors ever collaborate.
 */
async function placePage(
	courseId: string,
	page: { id: string; parentId: string | null; position: number } | null,
	data: { title: string; slug: string; parentId: string | null },
	position: number | undefined,
	res: import("express").Response,
) {
	if (data.parentId) {
		const all = await db.page.findMany({
			where: { courseId },
			select: { id: true, parentId: true },
		});
		const parents = new Map(all.map((p) => [p.id, p.parentId]));
		if (!parents.has(data.parentId)) return bad(res, "invalid_parent");
		for (let p: string | null = data.parentId; p; p = parents.get(p) ?? null) {
			if (p === page?.id) return bad(res, "invalid_parent");
		}
	}
	const siblings = await db.page.findMany({
		where: { courseId, parentId: data.parentId, NOT: { id: page?.id } },
		orderBy: { position: "asc" },
	});
	if (siblings.some((s) => s.slug === data.slug)) {
		return bad(res, "slug_taken", 409);
	}
	const keepPlace = page && page.parentId === data.parentId;
	const index = Math.min(
		position ?? (keepPlace ? page.position : siblings.length),
		siblings.length,
	);
	const saved = await db.$transaction(async (tx) => {
		const row = page
			? await tx.page.update({ where: { id: page.id }, data })
			: await tx.page.create({ data: { ...data, courseId, position: index } });
		const order = [...siblings.map((s) => s.id)];
		order.splice(index, 0, row.id);
		await Promise.all(
			order.map((id, i) =>
				tx.page.update({ where: { id }, data: { position: i } }),
			),
		);
		return { ...row, position: index };
	});
	res.status(page ? 200 : 201).json(saved);
}
