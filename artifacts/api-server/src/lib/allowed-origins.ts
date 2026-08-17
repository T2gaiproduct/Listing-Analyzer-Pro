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

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (getAllowedOrigins().includes(origin)) return true;
  const appUrl = process.env.APP_URL ?? process.env.PUBLIC_APP_URL;
  if (appUrl?.trim()) {
    try {
      if (new URL(appUrl.trim()).origin === origin) return true;
    } catch {
      /* ignore */
    }
  }
  if (process.env.NODE_ENV !== "production" && origin.endsWith(".trycloudflare.com")) {
    return true;
  }
  return false;
}

export function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return isAllowedOrigin(parsed.origin);
  } catch {
    return false;
  }
}
