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
