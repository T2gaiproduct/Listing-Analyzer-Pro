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

/** Production app uses Clerk custom domain (clerk.sellerlens.io) — never same-origin proxy. */
export function isSellerLensAppHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "sellerlens.io" || h === "www.sellerlens.io" || h.endsWith(".sellerlens.io");
}

/** Hosts that should use same-origin /api/__clerk (IP-only live deploys — not sellerlens.io). */
export function shouldUseSameOriginClerkProxy(hostname: string, publishableKey: string): boolean {
  if (isSellerLensAppHostname(hostname)) return false;

  // Quick tunnels: Clerk CDN (no same-origin proxy). Proxy + CAPTCHA often hang on random trycloudflare hosts.
  if (hostname.endsWith(".trycloudflare.com")) {
    return false;
  }

  if (publishableKey.startsWith("pk_live_") && isIpv4Hostname(hostname)) {
    return true;
  }

  return false;
}
