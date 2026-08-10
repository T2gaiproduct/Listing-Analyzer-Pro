import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface ShopifyConnectionStatus {
  connected: boolean;
  publishReady: boolean;
  storeUrl: string | null;
  clientId: string | null;
  connectedAt: string | null;
}

export async function fetchShopifyStatus(): Promise<ShopifyConnectionStatus> {
  return fetchJson<ShopifyConnectionStatus>(`${basePath}/api/shopify/status`);
}

export async function publishAuditToShopify(opts: {
  auditId: number;
  publishMode?: "draft" | "live";
}): Promise<{
  ok: boolean;
  message: string;
  listingUrl?: string;
  status?: "live" | "pending";
  warning?: string;
}> {
  const data = await fetchJson<{
    ok?: boolean;
    message?: string;
    error?: string;
    listingUrl?: string;
    status?: "live" | "pending";
    warning?: string;
  }>(`${basePath}/api/audits/${opts.auditId}/publish/shopify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publishMode: opts.publishMode ?? "draft" }),
  });
  return {
    ok: true,
    message: data.message ?? "Published to Shopify",
    listingUrl: data.listingUrl,
    status: data.status,
    warning: data.warning,
  };
}
