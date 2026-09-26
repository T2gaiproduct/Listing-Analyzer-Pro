const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const BULK_PRODUCTS_EXPORT_MAX = 100;

export interface BulkExportProductItem {
  auditId: number;
  workspaceId?: number | null;
}

export interface BulkProductsExportStats {
  exportedCount: number;
  skippedCount: number;
}

export async function downloadBulkProductsExcel(opts: {
  items: BulkExportProductItem[];
  accountOverview: boolean;
  marketplace?: string;
}): Promise<BulkProductsExportStats> {
  if (opts.items.length === 0) {
    throw new Error("No listings to export.");
  }
  if (opts.items.length > BULK_PRODUCTS_EXPORT_MAX) {
    throw new Error(`You can export up to ${BULK_PRODUCTS_EXPORT_MAX} listings at a time.`);
  }

  const scope = opts.accountOverview ? "?scope=account" : "";
  const url = `${basePath}/api/products/export/excel${scope}`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: opts.items,
      marketplace: opts.marketplace ?? "US",
    }),
  });

  if (!res.ok) {
    const contentType = res.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? `Export failed (${res.status})`);
    }
    throw new Error(`Export failed (${res.status})`);
  }

  const exportedCount = Number(res.headers.get("X-Export-Exported-Count") ?? "0");
  const skippedCount = Number(res.headers.get("X-Export-Skipped-Count") ?? "0");

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `product-explorer-listings.xlsx`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);

  return {
    exportedCount: exportedCount > 0 ? exportedCount : opts.items.length - skippedCount,
    skippedCount,
  };
}
