import { blockSchema } from "../../shared/index.ts";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import { loadOwnedCourse } from "../courses/routes.ts";

const createSchema = z.object({
	type: z.string(),
	config: z.unknown(),
	position: z.int().min(0).optional(),
});
const updateSchema = z.object({
	config: z.unknown().optional(),
	position: z.int().min(0).optional(),
});

/**
 * Block CRUD for one container: a page (`/courses/:id/pages/:pageId/blocks`)
 * or the course's selling page (`/courses/:id/blocks`, pageId null).
 */
export const blocksRouter = Router({ mergeParams: true });

/** Course must be owned; a given pageId must belong to it. Answers itself on failure. */
async function scope(
	req: import("express").Request,
	res: import("express").Response,
) {
	const course = await loadOwnedCourse(req, res);
	if (!course) return null;
	const pageId = req.params.pageId ? String(req.params.pageId) : null;
	if (
		pageId &&
		!(await db.page.findFirst({ where: { id: pageId, courseId: course.id } }))
	) {
		res.status(404).json({ error: "not_found" });
		return null;
	}
	return { courseId: course.id, pageId };
}

blocksRouter.get("/", async (req, res) => {
	const where = await scope(req, res);
	if (where)
		res.json(await db.block.findMany({ where, orderBy: { position: "asc" } }));
});

blocksRouter.post("/", async (req, res) => {
	const where = await scope(req, res);
	if (!where) return;
	const input = createSchema.safeParse(req.body);
	const block = blockSchema.safeParse(input.data);
	if (
		!input.success ||
		!block.success ||
		!(await ownsVideo(where.courseId, block.data))
	) {
		res.status(400).json({ error: "invalid_block" });
		return;
	}
	const siblings = await db.block.findMany({
		where,
		orderBy: { position: "asc" },
	});
	const index = Math.min(
		input.data.position ?? siblings.length,
		siblings.length,
	);
	res.status(201).json(
		await db.$transaction(async (tx) => {
			const row = await tx.block.create({
				data: {
					...where,
					type: block.data.type,
					config: block.data.config,
					position: index,
				},
			});
			return renumber(tx, siblings, row, index);
		}),
	);
});

blocksRouter.patch("/:blockId", async (req, res) => {
	const where = await scope(req, res);
	if (!where) return;
	const current = await db.block.findFirst({
		where: { ...where, id: String(req.params.blockId) },
	});
	const input = updateSchema.safeParse(req.body);
	if (!current) {
		res.status(404).json({ error: "not_found" });
		return;
	}
	const block = blockSchema.safeParse({
		type: current.type,
		config: input.data?.config ?? current.config,
	});
	if (
		!input.success ||
		!block.success ||
		!(await ownsVideo(where.courseId, block.data))
	) {
		res.status(400).json({ error: "invalid_block" });
		return;
	}
	const siblings = await db.block.findMany({
		where: { ...where, NOT: { id: current.id } },
		orderBy: { position: "asc" },
	});
	const index = Math.min(
		input.data.position ?? current.position,
		siblings.length,
	);
	res.json(
		await db.$transaction(async (tx) => {
			const row = await tx.block.update({
				where: { id: current.id },
				data: { config: block.data.config },
			});
			return renumber(tx, siblings, row, index);
		}),
	);
});

blocksRouter.delete("/:blockId", async (req, res) => {
	const where = await scope(req, res);
	if (!where) return;
	const { count } = await db.block.deleteMany({
		where: { ...where, id: String(req.params.blockId) },
	});
	res.status(count ? 204 : 404).end();
});

/** A video block may only point at a video uploaded to the same course. */
async function ownsVideo(
	courseId: string,
	block: { type: string; config: unknown },
) {
	if (block.type !== "video") return true;
	const { videoId } = block.config as { videoId?: string };
	if (!videoId) return true; // YouTube embed, nothing of ours to own
	return !!(await db.video.findFirst({ where: { id: videoId, courseId } }));
}

/** Puts `row` at `index` among `siblings` and rewrites positions as 0..n-1. */
async function renumber<T extends { id: string }>(
	tx: Pick<typeof db, "block">,
	siblings: { id: string }[],
	row: T,
	index: number,
) {
	const order = siblings.map((s) => s.id);
	order.splice(index, 0, row.id);
	await Promise.all(
		order.map((id, i) =>
			tx.block.update({ where: { id }, data: { position: i } }),
		),
	);
	return { ...row, position: index };
}
