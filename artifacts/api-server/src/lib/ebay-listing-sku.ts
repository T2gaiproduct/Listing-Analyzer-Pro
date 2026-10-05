/** Stable SKU assigned on eBay before bulk_migrate_listing when the listing has none. */
export function generatedEbayListingSku(itemId: string): string {
  const id = itemId.trim();
  return `SL-${id}`;
}

export function listingNeedsGeneratedSku(sku: string | null | undefined): boolean {
  return !sku?.trim();
}

const EBAY_INVENTORY_SKU_MAX_LEN = 50;

/** eBay Inventory API SKUs: letters and digits only, max 50 (hyphens in `SL-{id}` are not allowed). */
export function isValidEbayInventorySku(sku: string | null | undefined): boolean {
  const trimmed = sku?.trim() ?? "";
  if (!trimmed || trimmed.length > EBAY_INVENTORY_SKU_MAX_LEN) return false;
  return /^[A-Za-z0-9]+$/.test(trimmed);
}

export function normalizeToEbayInventorySku(sku: string | null | undefined): string | null {
  const alnum = (sku?.trim() ?? "").replace(/[^A-Za-z0-9]/g, "");
  if (!alnum) return null;
  const clipped = alnum.slice(0, EBAY_INVENTORY_SKU_MAX_LEN);
  return clipped.length > 0 ? clipped : null;
}

/** SKU used for Inventory API create/offer (not the Trading-only `SL-{itemId}` link label). */
/** Read sku from eBay offer JSON (string or number). */
export function isEbayOfferNotAvailableMessage(message: string): boolean {
  return /\[?25713\]?|offer is not available/i.test(message);
}

export function coerceEbayOfferSku(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "";
}

/** Stable inventory SKU for List-as-new (one eBay inventory item per SellerLens product). */
export function defaultEbayInventorySkuForAudit(auditId: number): string {
  const sku = `SL${auditId}`;
  if (!isValidEbayInventorySku(sku)) {
    throw new Error("Could not derive a valid eBay inventory SKU for this product.");
  }
  return sku;
}

/** Fallback inventory SKU when sandbox still has a broken offer on the default SKU. */
export function alternateEbayInventorySkuForAudit(auditId: number): string {
  const suffix = Date.now().toString(36).slice(-5).replace(/[^a-z0-9]/gi, "").toUpperCase() || "R";
  const sku = `SL${auditId}R${suffix}`.slice(0, 50);
  if (!isValidEbayInventorySku(sku)) {
    return defaultEbayInventorySkuForAudit(auditId);
  }
  return sku;
}

export function resolveEbayInventorySku(opts: {
  profileSku: string | null | undefined;
  listingSku: string | null | undefined;
  auditId: number;
}): string {
  for (const raw of [opts.profileSku, opts.listingSku]) {
    if (isValidEbayInventorySku(raw)) return raw!.trim();
    const normalized = normalizeToEbayInventorySku(raw);
    if (normalized && isValidEbayInventorySku(normalized)) return normalized;
  }
  const fallback = `SL${opts.auditId}`;
  if (!isValidEbayInventorySku(fallback)) {
    throw new Error("Could not derive a valid eBay inventory SKU for this product.");
  }
  return fallback;
}
