import { sql } from "drizzle-orm";
import { db, couponsTable } from "@workspace/db";
import { ANNOUNCEMENT_PROMO_DEFAULTS } from "./announcement-promo.js";
import { normalizeCouponCode } from "./coupon-validation.js";

export const DEFAULT_PROMO_COUPONS = [
  {
    code: ANNOUNCEMENT_PROMO_DEFAULTS.code,
    discountPercent: 20,
    description: "Launch offer — 20% off any plan",
    maxUses: 10_000,
  },
] as const;

/** Create a billing coupon for a homepage promo code when one does not exist yet. */
export async function ensurePromoCoupon(
  code: string,
  discountPercent = 20,
  description?: string,
  maxUses = 10_000,
): Promise<void> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return;

  const [existing] = await db
    .select({ id: couponsTable.id })
    .from(couponsTable)
    .where(sql`upper(${couponsTable.code}) = ${normalized}`);

  if (existing) return;

  await db.insert(couponsTable).values({
    code: normalized,
    description: description ?? `Promo code — ${discountPercent}% off`,
    discountPercent,
    maxUses,
    isActive: true,
  });
}

export async function ensureDefaultPromoCoupons(): Promise<void> {
  for (const coupon of DEFAULT_PROMO_COUPONS) {
    await ensurePromoCoupon(coupon.code, coupon.discountPercent, coupon.description, coupon.maxUses);
  }
}
