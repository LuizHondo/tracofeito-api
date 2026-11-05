import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import type { VideoHost } from "../../providers/video.ts";
import { loadOwnedCourse } from "../courses/routes.ts";

const PLAYBACK_TTL_MS = 60 * 60 * 1000;

/** Creator side, mounted at `/courses/:id/videos`. */
export function createVideosRouter(host: () => VideoHost) {
	const router = Router({ mergeParams: true });

	router.post("/", async (req, res) => {
		const course = await loadOwnedCourse(req, res);
		if (!course) return;
		const input = z
			.object({ title: z.string().min(1).max(200) })
			.safeParse(req.body);
		if (!input.success) {
			res.status(400).json({ error: "invalid_input" });
			return;
		}
		const { videoId, upload } = await host().createUpload(input.data.title);
		await db.video.create({ data: { id: videoId, courseId: course.id } });
		res.status(201).json({ videoId, upload });
	});

	router.get("/:videoId", async (req, res) => {
		const course = await loadOwnedCourse(req, res);
		if (!course) return;
		const video = await db.video.findFirst({
			where: { id: String(req.params.videoId), courseId: course.id },
		});
		if (video) res.json(video);
		else res.status(404).json({ error: "not_found" });
	});

	return router;
}

/** Host status webhook, mounted at `/webhooks/video`. */
export function createVideoWebhook(host: () => VideoHost) {
	const router = Router();
	router.post("/", async (req, res) => {
		const event = host().parseWebhook(req.body);
		if (!event) {
			res.status(400).json({ error: "invalid_webhook" });
			return;
		}
		await db.video.updateMany({
			where: { id: event.videoId },
			data: { status: event.status },
		});
		res.status(204).end();
	});
	return router;
}

/** Member side, mounted under `/content/:courseId` after the `hasAccess` gate. */
export function createPlaybackRouter(host: () => VideoHost) {
	const router = Router();
	router.get("/:courseId/videos/:videoId/playback", async (req, res) => {
		const video = await db.video.findFirst({
			where: {
				id: String(req.params.videoId),
				courseId: res.locals.course.id,
				status: "ready",
			},
		});
		if (!video) {
			res.status(404).json({ error: "not_found" });
			return;
		}
		const expiresAt = new Date(Date.now() + PLAYBACK_TTL_MS);
		res.json({ url: host().playbackUrl(video.id, expiresAt), expiresAt });
	});
	return router;
}
