import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface EbayConnectionStatus {
  connected: boolean;
  publishReady: boolean;
  environment: "sandbox" | "production" | null;
  username: string | null;
  ebayUserId: string | null;
  connectedAt: string | null;
}

export async function fetchEbayStatus(): Promise<EbayConnectionStatus> {
  return fetchJson<EbayConnectionStatus>(`${basePath}/api/ebay/status`);
}

export async function publishAuditToEbay(opts: { auditId: number }): Promise<{
  ok: boolean;
  message: string;
  listingUrl?: string;
  warning?: string;
}> {
  const data = await fetchJson<{
    ok?: boolean;
    message?: string;
    error?: string;
    listingUrl?: string;
    warning?: string;
  }>(`${basePath}/api/audits/${opts.auditId}/publish/ebay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return {
    ok: true,
    message: data.message ?? "Published to eBay.",
    listingUrl: data.listingUrl,
    warning: data.warning,
  };
}
