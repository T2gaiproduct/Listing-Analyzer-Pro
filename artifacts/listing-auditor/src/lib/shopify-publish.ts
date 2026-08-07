const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface ShopifyConnectionStatus {
  connected: boolean;
  publishReady: boolean;
  storeUrl: string | null;
  clientId: string | null;
  connectedAt: string | null;
}

export async function fetchShopifyStatus(): Promise<ShopifyConnectionStatus> {
  const res = await fetch(`${basePath}/api/shopify/status`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load Shopify status");
  return res.json() as Promise<ShopifyConnectionStatus>;
}

export async function publishAuditToShopify(opts: {
  auditId: number;
  publishMode?: "draft" | "live";
}): Promise<{
  ok: boolean;
  message: string;
  listingUrl?: string;
  status?: "live" | "pending";
}> {
  const res = await fetch(`${basePath}/api/audits/${opts.auditId}/publish/shopify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ publishMode: opts.publishMode ?? "draft" }),
  });
  const data = await res.json().catch(() => ({})) as {
    ok?: boolean;
    message?: string;
    error?: string;
    listingUrl?: string;
    status?: "live" | "pending";
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Publish failed");
  }
  return {
    ok: true,
    message: data.message ?? "Published to Shopify",
    listingUrl: data.listingUrl,
    status: data.status,
  };
}
