import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface WooCommerceConnectionStatus {
  connected: boolean;
  publishReady: boolean;
  storeUrl: string | null;
  consumerKey: string | null;
  connectedAt: string | null;
}

export async function fetchWooCommerceStatus(): Promise<WooCommerceConnectionStatus> {
  return fetchJson<WooCommerceConnectionStatus>(`${basePath}/api/woocommerce/status`);
}

export async function publishAuditToWooCommerce(opts: {
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
  }>(`${basePath}/api/audits/${opts.auditId}/publish/woocommerce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publishMode: opts.publishMode ?? "draft" }),
  });
  return {
    ok: true,
    message: data.message ?? "Published to WooCommerce",
    listingUrl: data.listingUrl,
    status: data.status,
    warning: data.warning,
  };
}
