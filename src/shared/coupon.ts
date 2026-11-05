export type CouponValue = { type: "percent" | "fixed"; value: number };

/** "30%" -> percent 30 (1-100); "30" or "30,50" -> fixed reais. Returns null if invalid. */
export function parseCouponValue(input: string): CouponValue | null {
	const s = input.trim().replace(",", ".");
	const percent = s.endsWith("%");
	const num = percent ? s.slice(0, -1).trim() : s;
	if (!/^\d+(\.\d+)?$/.test(num)) return null;
	const value = Number(num);
	if (value <= 0 || (percent && value > 100)) return null;
	return { type: percent ? "percent" : "fixed", value };
}
