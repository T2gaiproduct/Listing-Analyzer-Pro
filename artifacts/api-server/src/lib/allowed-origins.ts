import { isCloudAgentQuickTunnelHostname } from "./cloud-agent-quick-tunnel.js";

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    "http://localhost:19145",
    "http://localhost:3000",
    "http://127.0.0.1:19145",
    "http://127.0.0.1:3000",
    "https://sellerlens.io",
    "https://www.sellerlens.io",
  ]);

  const appUrl = process.env.APP_URL ?? process.env.PUBLIC_APP_URL;
  if (appUrl?.trim()) {
    try {
      origins.add(new URL(appUrl.trim()).origin);
    } catch {
      /* ignore invalid APP_URL */
    }
  }

  const tunnelPublicUrl = process.env.CLOUDFLARE_TUNNEL_PUBLIC_URL?.trim();
  if (tunnelPublicUrl) {
    try {
      origins.add(new URL(tunnelPublicUrl).origin);
    } catch {
      /* ignore invalid CLOUDFLARE_TUNNEL_PUBLIC_URL */
    }
  }

  for (const domain of process.env.REPLIT_DOMAINS?.split(",") ?? []) {
    const trimmed = domain.trim();
    if (!trimmed) continue;
    origins.add(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  }

  for (const origin of process.env.ALLOWED_ORIGINS?.split(",") ?? []) {
    const trimmed = origin.trim();
    if (trimmed) origins.add(trimmed);
  }

  return [...origins];
}

function isPublicIpOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
    if (hostname.includes(":") && hostname.startsWith("[")) return true;
    return false;
  } catch {
    return false;
  }
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (isPublicIpOrigin(origin)) return true;
  if (getAllowedOrigins().includes(origin)) return true;
  const appUrl = process.env.APP_URL ?? process.env.PUBLIC_APP_URL;
  if (appUrl?.trim()) {
    try {
      if (new URL(appUrl.trim()).origin === origin) return true;
    } catch {
      /* ignore */
    }
  }
  if (process.env.NODE_ENV !== "production") {
    try {
      if (isCloudAgentQuickTunnelHostname(new URL(origin).hostname)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    // PayPal/Stripe return URLs on ephemeral quick tunnels (dev only; not production deploys).
    if (
      process.env.NODE_ENV !== "production"
      && parsed.hostname.endsWith(".trycloudflare.com")
    ) {
      return true;
    }
    return isAllowedOrigin(parsed.origin);
  } catch {
    return false;
  }
}
