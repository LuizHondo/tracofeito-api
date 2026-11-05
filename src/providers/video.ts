import { createHash } from "node:crypto";

export type VideoStatus = "processing" | "ready" | "failed";

export type VideoUpload = {
	videoId: string;
	/** What the browser needs to upload the file straight to the host (TUS). */
	upload: { url: string; headers: Record<string, string> };
};

export interface VideoHost {
	createUpload(title: string): Promise<VideoUpload>;
	/** Status change from a host webhook body, or null if it isn't one. */
	parseWebhook(body: unknown): { videoId: string; status: VideoStatus } | null;
	/** Player URL that stops working at `expiresAt`. */
	playbackUrl(videoId: string, expiresAt: Date): string;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// Bunny Stream status codes: 0-2 queued/processing/encoding, 3 finished,
// 4 resolution finished (already playable), 5-6 failed.
const bunnyStatus = (code: number): VideoStatus =>
	code === 3 || code === 4 ? "ready" : code >= 5 ? "failed" : "processing";

export class BunnyVideoHost implements VideoHost {
	constructor(
		private libraryId: string,
		private apiKey: string,
		private tokenKey: string,
		private uploadTtlMs = 6 * 60 * 60 * 1000,
		private now = () => Date.now(),
	) {}

	async createUpload(title: string) {
		const res = await fetch(
			`https://video.bunnycdn.com/library/${this.libraryId}/videos`,
			{
				method: "POST",
				headers: { AccessKey: this.apiKey, "content-type": "application/json" },
				body: JSON.stringify({ title }),
			},
		);
		if (!res.ok) throw new Error(`bunny ${res.status}: ${await res.text()}`);
		const { guid: videoId } = (await res.json()) as { guid: string };
		const expire = Math.floor((this.now() + this.uploadTtlMs) / 1000);
		return {
			videoId,
			upload: {
				url: "https://video.bunnycdn.com/tusupload",
				headers: {
					AuthorizationSignature: sha256(
						`${this.libraryId}${this.apiKey}${expire}${videoId}`,
					),
					AuthorizationExpire: String(expire),
					VideoId: videoId,
					LibraryId: this.libraryId,
				},
			},
		};
	}

	parseWebhook(body: unknown) {
		const b = body as {
			VideoLibraryId?: unknown;
			VideoGuid?: unknown;
			Status?: unknown;
		};
		if (
			!b ||
			String(b.VideoLibraryId) !== this.libraryId ||
			typeof b.VideoGuid !== "string" ||
			typeof b.Status !== "number"
		)
			return null;
		return { videoId: b.VideoGuid, status: bunnyStatus(b.Status) };
	}

	playbackUrl(videoId: string, expiresAt: Date) {
		const expires = Math.floor(expiresAt.getTime() / 1000);
		const token = sha256(`${this.tokenKey}${videoId}${expires}`);
		return `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}?token=${token}&expires=${expires}`;
	}
}

export function videoHostFromEnv(): VideoHost {
	const { BUNNY_LIBRARY_ID, BUNNY_API_KEY, BUNNY_TOKEN_KEY } = process.env;
	if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY || !BUNNY_TOKEN_KEY)
		throw new Error(
			"BUNNY_LIBRARY_ID, BUNNY_API_KEY, BUNNY_TOKEN_KEY required",
		);
	return new BunnyVideoHost(BUNNY_LIBRARY_ID, BUNNY_API_KEY, BUNNY_TOKEN_KEY);
}
