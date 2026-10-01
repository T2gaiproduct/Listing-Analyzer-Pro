/** Stable SKU assigned on eBay before bulk_migrate_listing when the listing has none. */
export function generatedEbayListingSku(itemId: string): string {
  const id = itemId.trim();
  return `SL-${id}`;
}

export function listingNeedsGeneratedSku(sku: string | null | undefined): boolean {
  return !sku?.trim();
}
