import { parseCouponValue } from "../../shared/index.ts";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db.ts";
import { loadOwnedCourse } from "../courses/routes.ts";
import { findActiveCoupon, normalizeCode } from "./coupons.ts";

const createSchema = z.strictObject({
	code: z.string().trim().min(1).max(40),
	value: z.string(), // "30%" or "30"
	expiresAt: z.coerce.date(),
});

export const couponsRouter = Router({ mergeParams: true });

couponsRouter.get("/", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	res.json(
		await db.coupon.findMany({
			where: { courseId: course.id },
			orderBy: { createdAt: "desc" },
		}),
	);
});

couponsRouter.post("/", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	const parsed = createSchema.safeParse(req.body);
	const value = parsed.success ? parseCouponValue(parsed.data.value) : null;
	if (!parsed.success || !value) {
		res.status(400).json({ error: "invalid_input" });
		return;
	}
	if (parsed.data.expiresAt <= new Date()) {
		res.status(400).json({ error: "already_expired" });
		return;
	}
	if (await findActiveCoupon(course.id, parsed.data.code)) {
		res.status(409).json({ error: "coupon_code_taken" });
		return;
	}
	res.status(201).json(
		await db.coupon.create({
			data: {
				courseId: course.id,
				code: normalizeCode(parsed.data.code),
				type: value.type,
				value: value.value,
				expiresAt: parsed.data.expiresAt,
			},
		}),
	);
});

couponsRouter.post("/:couponId/cancel", async (req, res) => {
	const course = await loadOwnedCourse(req, res);
	if (!course) return;
	const { count } = await db.coupon.updateMany({
		where: {
			id: String(req.params.couponId),
			courseId: course.id,
			canceledAt: null,
		},
		data: { canceledAt: new Date() },
	});
	res.status(count ? 204 : 404).end();
});
