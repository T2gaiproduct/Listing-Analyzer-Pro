/** IPv4 host (no port). Used for self-hosted / IP-only deployments. */
export function isIpv4Hostname(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/** Hosts that should use same-origin /api/__clerk (production Clerk keys + Cloudflare dev tunnels). */
export function shouldUseSameOriginClerkProxy(hostname: string, publishableKey: string): boolean {
  if (hostname.endsWith(".trycloudflare.com")) return true;

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
