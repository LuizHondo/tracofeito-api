import { randomBytes } from "node:crypto";
import { db } from "../../db.ts";
import type { TokenType } from "../../generated/prisma/client.ts";
import { sha256 } from "./session.ts";

const TTL_MS: Record<TokenType, number> = {
	verify_email: 24 * 60 * 60 * 1000,
	reset_password: 60 * 60 * 1000,
};

export async function createToken(
	userId: string,
	type: TokenType,
): Promise<string> {
	const raw = randomBytes(32).toString("base64url");
	await db.token.create({
		data: {
			id: sha256(raw),
			userId,
			type,
			expiresAt: new Date(Date.now() + TTL_MS[type]),
		},
	});
	return raw;
}

/** Single-use: returns the user id and burns the token, or null if unknown, used or expired. */
export async function consumeToken(
	raw: string,
	type: TokenType,
): Promise<string | null> {
	const id = sha256(raw);
	const { count } = await db.token.updateMany({
		where: { id, type, usedAt: null, expiresAt: { gt: new Date() } },
		data: { usedAt: new Date() },
	});
	if (!count) return null;
	return (await db.token.findUniqueOrThrow({ where: { id } })).userId;
}
