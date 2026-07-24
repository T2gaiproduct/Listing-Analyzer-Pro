const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface AmazonConnectionStatus {
  configured: boolean;
  enabled: boolean;
  sandbox: boolean;
  canSignRequests: boolean;
  connected: boolean;
  sellerId: string | null;
  marketplaceIds: string[];
  defaultMarketplace: string;
}

export async function fetchAmazonStatus(): Promise<AmazonConnectionStatus> {
  const res = await fetch(`${basePath}/api/amazon/status`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load Amazon status");
  return res.json() as Promise<AmazonConnectionStatus>;
}

export async function startAmazonConnect(): Promise<void> {
  const res = await fetch(`${basePath}/api/amazon/oauth/authorize`, { credentials: "include" });
  const data = await res.json() as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Could not start Amazon authorization");
  }
  window.location.href = data.url;
}

export async function disconnectAmazon(): Promise<void> {
  const res = await fetch(`${basePath}/api/amazon/connection`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to disconnect Amazon");
}

export async function publishAuditToAmazon(opts: {
  auditId: number;
  marketplace: string;
}): Promise<{ ok: boolean; message: string; sandbox?: boolean }> {
  const res = await fetch(`${basePath}/api/audits/${opts.auditId}/publish/amazon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ marketplace: opts.marketplace }),
  });
  const data = await res.json().catch(() => ({})) as { ok?: boolean; message?: string; error?: string; sandbox?: boolean };
  if (!res.ok) {
    throw new Error(data.error ?? "Publish failed");
  }
  return { ok: true, message: data.message ?? "Published", sandbox: data.sandbox };
}
