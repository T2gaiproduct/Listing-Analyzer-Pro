export function clerkFrontendHostFromPublishableKey(publishableKey: string): string | null {
  const trimmed = publishableKey.trim();
  if (!trimmed.startsWith("pk_test_") && !trimmed.startsWith("pk_live_")) return null;
  const b64 = trimmed.replace(/^pk_(?:test|live)_/, "");
  const pad = (4 - (b64.length % 4)) % 4;
  try {
    return atob(`${b64}${"=".repeat(pad)}`).replace(/\$$/, "");
  } catch {
    return null;
  }
}

/** IPv4 host (no port). Used for self-hosted / IP-only deployments. */
export function isIpv4Hostname(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/** Hosts that should use same-origin /api/__clerk (production domain — not ephemeral quick tunnels). */
export function shouldUseSameOriginClerkProxy(hostname: string, publishableKey: string): boolean {
  if (hostname.endsWith(".trycloudflare.com")) return false;

  if (
    hostname === "sellerlens.io"
    || hostname === "www.sellerlens.io"
    || hostname.endsWith(".sellerlens.io")
  ) {
    return true;
  }

  if (publishableKey.startsWith("pk_live_") && isIpv4Hostname(hostname)) {
    return true;
  }

  return false;
}
