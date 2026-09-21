import type { DeductResult } from "./credits.js";

/** Attach credit usage to JSON API responses for immediate client toasts. */
export function withCreditUsage<T extends Record<string, unknown>>(
  body: T,
  deduct: DeductResult,
): T & { creditUsage?: NonNullable<DeductResult["usage"]> } {
  if (!deduct.success || !deduct.usage) {
    return body;
  }
  return { ...body, creditUsage: deduct.usage };
}
