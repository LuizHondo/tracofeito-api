import { db } from "../../db.ts";
import type { User } from "../../generated/prisma/client.ts";

/**
 * The one access check (pages, progress, video playback): admins, the course
 * creator, and users whose subscription is lifetime (`expiresAt` null) or unexpired.
 */
export async function hasAccess(
	user: Pick<User, "id" | "role">,
	course: { id: string; ownerId: string },
): Promise<boolean> {
	if (user.role === "admin" || user.id === course.ownerId) return true;
	const sub = await db.subscription.findUnique({
		where: { userId_courseId: { userId: user.id, courseId: course.id } },
	});
	return !!sub && (sub.expiresAt === null || sub.expiresAt > new Date());
}
