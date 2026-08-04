import type { Request } from "express";
import { isAllowedOrigin, isAllowedRedirectUrl } from "./allowed-origins.js";

const DEFAULT_APP_URL = "https://listingauditor.com";

/** Canonical public site URL from env (no trailing slash). */
export function getConfiguredAppUrl(): string | undefined {
  const raw = process.env.APP_URL ?? process.env.PUBLIC_APP_URL;
  if (!raw?.trim()) return undefined;
  return raw.trim().replace(/\/$/, "");
}

function originFromRequest(req: Request): string | undefined {
  const headerOrigin = req.get("origin");
  if (headerOrigin) return headerOrigin.replace(/\/$/, "");

  const referer = req.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      /* ignore */
    }
  }

  const forwardedHost = req.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    const proto = (req.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() ?? "https";
    if (host) {
      try {
        return new URL(`${proto}://${host}`).origin;
      } catch {
        /* ignore */
      }
    }
  }

  const host = req.get("host");
  if (host) {
    const proto = req.get("x-forwarded-proto")?.split(",")[0]?.trim()
      ?? (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    try {
      return new URL(`${proto}://${host}`).origin;
    } catch {
      /* ignore */
    }
  }

  return undefined;
}

/**
 * Resolve the public app origin for payment return URLs and redirects.
 * Never returns localhost in production when APP_URL or request host is available.
 */
export function resolvePublicAppBaseUrl(options?: {
  origin?: string;
  req?: Request;
}): string {
  const candidates: string[] = [];

  if (options?.origin) candidates.push(options.origin.replace(/\/$/, ""));
  if (options?.req) {
    const fromReq = originFromRequest(options.req);
    if (fromReq) candidates.push(fromReq);
  }

  const configured = getConfiguredAppUrl();
  if (configured) {
    try {
      candidates.push(new URL(configured).origin);
    } catch {
      candidates.push(configured);
    }
  }

  for (const candidate of candidates) {
    if (isAllowedOrigin(candidate)) return candidate;
  }

  if (configured) return configured;

  const replit = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (replit) {
    return replit.startsWith("http") ? replit.replace(/\/$/, "") : `https://${replit}`;
  }

  if (process.env.NODE_ENV === "production") {
    return DEFAULT_APP_URL;
  }

  return "http://localhost:3000";
}

/** PayPal/Stripe return URL: prefer explicit client URL when allowed, else build from public base. */
export function resolvePaymentReturnUrl(
  returnUrl: string | undefined,
  defaultPath: string,
  options?: { origin?: string; req?: Request },
): string {
  if (returnUrl && isAllowedRedirectUrl(returnUrl)) {
    return returnUrl;
  }

  const base = resolvePublicAppBaseUrl(options);
  const path = defaultPath.startsWith("/") ? defaultPath : `/${defaultPath}`;
  return `${base}${path}`;
}
