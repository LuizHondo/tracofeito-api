import { z } from "zod";

const url = z.url({ protocol: /^https?$/ });

export const blockSchemas = {
	title: z.object({ text: z.string().trim().min(1).max(200) }),
	text: z.object({ markdown: z.string().min(1).max(20000) }),
	image: z.object({ url, alt: z.string().max(300).default("") }),
	// Either a video uploaded to our host, or a YouTube video embedded by id.
	video: z.union([
		z.object({ videoId: z.string().min(1) }),
		z.object({ youtubeId: z.string().regex(/^[\w-]{11}$/) }),
	]),
	url: z.object({ url, label: z.string().trim().min(1).max(200) }),
};

export type BlockType = keyof typeof blockSchemas;
export const blockTypes = Object.keys(blockSchemas) as BlockType[];

export const blockSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("title"), config: blockSchemas.title }),
	z.object({ type: z.literal("text"), config: blockSchemas.text }),
	z.object({ type: z.literal("image"), config: blockSchemas.image }),
	z.object({ type: z.literal("video"), config: blockSchemas.video }),
	z.object({ type: z.literal("url"), config: blockSchemas.url }),
]);

/** The 11-char video id in a youtube.com / youtu.be link, or null. */
export function youtubeId(link: string): string | null {
	let u: URL;
	try {
		u = new URL(link.trim());
	} catch {
		return null;
	}
	const host = u.hostname.replace(/^(www|m)\./, "");
	const id =
		host === "youtu.be"
			? u.pathname.slice(1)
			: host === "youtube.com" || host === "youtube-nocookie.com"
				? u.pathname === "/watch"
					? u.searchParams.get("v")
					: u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]
				: null;
	return id && /^[\w-]{11}$/.test(id) ? id : null;
}
