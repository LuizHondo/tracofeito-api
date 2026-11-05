import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
	pw: string,
	salt: Buffer,
	len: number,
) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scryptAsync(password, salt, 64);
	return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [salt, key] = stored.split(":");
	if (!salt || !key) return false;
	const expected = Buffer.from(key, "hex");
	const actual = await scryptAsync(
		password,
		Buffer.from(salt, "hex"),
		expected.length,
	);
	return timingSafeEqual(actual, expected);
}
