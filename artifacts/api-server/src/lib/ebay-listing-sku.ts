/** Stable SKU assigned on eBay before bulk_migrate_listing when the listing has none. */
export function generatedEbayListingSku(itemId: string): string {
  const id = itemId.trim();
  return `SL-${id}`;
}

export function listingNeedsGeneratedSku(sku: string | null | undefined): boolean {
  return !sku?.trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
