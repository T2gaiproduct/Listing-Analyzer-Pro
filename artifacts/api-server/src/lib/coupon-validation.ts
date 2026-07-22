import { eq, and, sql } from "drizzle-orm";
import { db, couponsTable } from "@workspace/db";
import type { Coupon } from "@workspace/db";

export type CouponValidationError =
  | "missing"
  | "not_found"
  | "usage_limit"
  | "expired"
  | "invalid_discount";

const ERROR_MESSAGES: Record<CouponValidationError, string> = {
  missing: "No coupon code provided",
  not_found: "Coupon not found or expired",
  usage_limit: "Coupon has reached its usage limit",
  expired: "Coupon has expired",
  invalid_discount: "Coupon has no discount configured",
};

export function couponErrorMessage(error: CouponValidationError): string {
  return ERROR_MESSAGES[error];
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function validateCouponRecord(coupon: Coupon | undefined): CouponValidationError | null {
  if (!coupon) return "not_found";
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return "usage_limit";
  if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) return "expired";
  if (!coupon.discountPercent && !coupon.discountAmount) return "invalid_discount";
  return null;
}

export async function loadActiveCoupon(code: string): Promise<Coupon | undefined> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return undefined;
  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(and(sql`upper(${couponsTable.code}) = ${normalized}`, eq(couponsTable.isActive, true)));
  return coupon;
}

export async function resolveCoupon(code: string): Promise<
  | { ok: true; coupon: Coupon }
  | { ok: false; error: CouponValidationError }
> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { ok: false, error: "missing" };
  const coupon = await loadActiveCoupon(normalized);
  const validationError = validateCouponRecord(coupon);
  if (validationError) return { ok: false, error: validationError };
  return { ok: true, coupon: coupon! };
}

export function computeCouponDiscountAmount(coupon: Coupon, basePrice: number): number {
  if (coupon.discountPercent) {
    return Math.round(basePrice * coupon.discountPercent / 100);
  }
  return coupon.discountAmount ?? 0;
}

export async function incrementCouponUsage(couponId: number, usedCount: number): Promise<void> {
  await db.update(couponsTable).set({ usedCount: usedCount + 1 }).where(eq(couponsTable.id, couponId));
}
