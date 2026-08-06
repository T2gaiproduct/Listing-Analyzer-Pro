import { sql, type SQL } from "drizzle-orm";
import type { auditsTable } from "@workspace/db";

export type ProductSourceType = "listing" | "audit" | "graphics" | "video" | "ads";

export function parseProductSourceType(raw: unknown): ProductSourceType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (
    value === "listing"
    || value === "audit"
    || value === "graphics"
    || value === "video"
    || value === "ads"
  ) {
    return value;
  }
  return null;
}

export function productDetailPath(id: number, sourceType: ProductSourceType): string {
  return `/products/${id}?source=${sourceType}`;
}

export const PRODUCT_SOURCE_TRY_ORDER: ProductSourceType[] = [
  "listing",
  "audit",
  "graphics",
  "video",
  "ads",
];

export function auditAsinScopeFilter(
  sourceType: "listing" | "audit",
  asinColumn: typeof auditsTable.asin,
): SQL {
  return sourceType === "listing"
    ? sql`(${asinColumn} IS NULL OR trim(${asinColumn}) = '' OR ${asinColumn} LIKE 'shopify:%')`
    : sql`(${asinColumn} IS NOT NULL AND trim(${asinColumn}) != '' AND ${asinColumn} NOT LIKE 'shopify:%')`;
}
