/** Amazon marketplaces for Build Your Brand export (mirrors api-server). */
export const AMAZON_MARKETPLACES = [
  { id: "US", label: "United States (amazon.com)" },
  { id: "CA", label: "Canada (amazon.ca)" },
  { id: "MX", label: "Mexico (amazon.com.mx)" },
  { id: "UK", label: "United Kingdom (amazon.co.uk)" },
  { id: "DE", label: "Germany (amazon.de)" },
  { id: "FR", label: "France (amazon.fr)" },
  { id: "IT", label: "Italy (amazon.it)" },
  { id: "ES", label: "Spain (amazon.es)" },
  { id: "NL", label: "Netherlands (amazon.nl)" },
  { id: "SE", label: "Sweden (amazon.se)" },
  { id: "PL", label: "Poland (amazon.pl)" },
  { id: "BE", label: "Belgium (amazon.com.be)" },
  { id: "IN", label: "India (amazon.in)" },
  { id: "JP", label: "Japan (amazon.co.jp)" },
  { id: "AU", label: "Australia (amazon.com.au)" },
  { id: "SG", label: "Singapore (amazon.sg)" },
  { id: "AE", label: "UAE (amazon.ae)" },
  { id: "SA", label: "Saudi Arabia (amazon.sa)" },
  { id: "TR", label: "Turkey (amazon.com.tr)" },
  { id: "BR", label: "Brazil (amazon.com.br)" },
] as const;

export type AmazonMarketplaceId = (typeof AMAZON_MARKETPLACES)[number]["id"];

export type ExportPlatform = "amazon" | "shopify";

export const EXPORT_PLATFORMS: { id: ExportPlatform; label: string; description: string }[] = [
  { id: "amazon", label: "Amazon", description: "Flat-file Excel for Seller Central bulk upload" },
  { id: "shopify", label: "Shopify", description: "Product CSV for Shopify admin import" },
];

export async function downloadAuditExport(opts: {
  auditId: number;
  format: "excel" | "zip";
  platform: ExportPlatform;
  marketplace?: AmazonMarketplaceId;
  basePath: string;
}): Promise<void> {
  const endpoint = opts.format === "excel" ? "excel" : "zip";
  const params = new URLSearchParams({ platform: opts.platform });
  if (opts.platform === "amazon" && opts.marketplace) {
    params.set("marketplace", opts.marketplace);
  }
  const url = `${opts.basePath}/api/audits/${opts.auditId}/export/${endpoint}?${params.toString()}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const contentType = res.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? `Export failed (${res.status})`);
    }
    if (res.status === 404) {
      throw new Error("Export is not available on this server yet. Please refresh and try again, or contact support if the issue persists.");
    }
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const defaultExt = opts.platform === "shopify" && opts.format === "excel"
    ? "csv"
    : opts.format === "excel"
      ? "xlsx"
      : "zip";
  const filename = match?.[1] ?? `listing-${opts.platform}.${defaultExt}`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
