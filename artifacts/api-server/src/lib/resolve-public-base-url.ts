import fs from "node:fs";
import type { Request } from "express";
import { getConfiguredAppUrl, resolvePublicAppBaseUrl } from "./app-base-url.js";

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return true;
  }
}

function readStableTunnelPublicUrl(): string | undefined {
  for (const candidate of [
    process.env.CLOUDFLARE_TUNNEL_PUBLIC_URL,
    process.env.LOCAL_DEV_PUBLIC_URL,
  ]) {
    const raw = candidate?.trim().replace(/\/$/, "");
    if (raw?.startsWith("https://") || raw?.startsWith("http://")) return raw;
  }
  return undefined;
}

function readDevTunnelPublicUrl(): string | undefined {
  if (process.env.NODE_ENV === "production" && getConfiguredAppUrl()) {
    return undefined;
  }

  const stable = readStableTunnelPublicUrl();
  if (stable) return stable;

  try {
    const raw = fs.readFileSync("/tmp/public-url.txt", "utf8");
    const line = raw
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("https://") || entry.startsWith("http://"));
    return line?.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

/** Public origin for asset URLs (exports, marketplace publish). Prefers browser/proxy origin over API bind address. */
export function resolvePublicBaseUrl(req: Request): string {
  const fromRequest = resolvePublicAppBaseUrl({ req });
  if (!isLocalhostOrigin(fromRequest)) {
    return fromRequest;
  }

  const tunnel = readDevTunnelPublicUrl();
  if (tunnel) {
    return tunnel;
  }

  return fromRequest;
}

/**
 * Origin for public listing-preview share links (SPA route — never API port 8080).
 */
export function resolveListingPreviewShareBaseUrl(req: Request): string {
  let base = resolvePublicBaseUrl(req).replace(/\/$/, "");

  try {
    const url = new URL(base);
    if (url.port === "8080") {
      url.protocol = "http:";
      url.port = "3000";
      base = url.origin;
    }
    if (
      (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1")
      && base.startsWith("https:")
    ) {
      base = `http://${url.host.replace(/:8080$/, ":3000")}`;
    }
  } catch {
    /* keep base */
  }

  if (/127\.0\.0\.1:8080|localhost:8080/i.test(base)) {
    const tunnel = readDevTunnelPublicUrl();
    if (tunnel) return tunnel.replace(/\/$/, "");
    return base.replace(/:8080/i, ":3000").replace(/^https:/i, "http:");
  }

  if (isLocalhostOrigin(base)) {
    const configured = getConfiguredAppUrl();
    if (configured && !isLocalhostOrigin(configured)) {
      try {
        const cfg = new URL(configured.startsWith("http") ? configured : `https://${configured}`);
        return cfg.origin;
      } catch {
        return configured.replace(/\/$/, "");
      }
    }
  }

  return base;
}

function resolveConfiguredHttpsBaseUrl(): string | undefined {
  const explicit = process.env.MARKETPLACE_PUBLISH_BASE_URL?.trim().replace(/\/$/, "");
  const configured = explicit || getConfiguredAppUrl();
  if (!configured || isLocalhostOrigin(configured)) return undefined;
  if (!configured.startsWith("https://")) return undefined;
  return configured;
}

/** WooCommerce/Shopify must fetch images from a public HTTPS URL — never localhost. */
export function resolveMarketplacePublishBaseUrl(req: Request): string {
  const fromRequest = resolvePublicAppBaseUrl({ req });
  try {
    const { hostname } = new URL(fromRequest);
    if (hostname.endsWith(".trycloudflare.com")) {
      return fromRequest;
    }
  } catch {
    /* ignore */
  }

  const configuredBase = resolveConfiguredHttpsBaseUrl();
  if (configuredBase) {
    return configuredBase;
  }

  const base = resolvePublicBaseUrl(req);
  if (isLocalhostOrigin(base)) {
    throw new Error(
      "Cannot publish store images from localhost. Open SellerLens through your Cloudflare preview link (or production URL) and publish again.",
    );
  }
  if (!base.startsWith("https://")) {
    throw new Error(
      "Marketplace publish requires HTTPS image URLs. Use your public preview or production site URL.",
    );
  }
  return base;
}

/**
 * Many VPS setups serve the SPA on :7000 while nginx exposes /api on port 80.
 * Signed export image URLs must hit the API origin, not the frontend-only port.
 */
export function normalizeAmazonExportImageBaseUrl(base: string): string {
  const trimmed = base.trim().replace(/\/$/, "");
  try {
    const url = new URL(trimmed);
    if (url.port === "7000") {
      url.port = "";
      return url.origin;
    }
  } catch {
    /* keep trimmed */
  }
  return trimmed;
}

/**
 * Base URL for Amazon export flat-file image columns.
 * Prefers configured HTTPS app URL so Excel/CSV links are not tied to a raw IP:port from the browser.
 */
export function resolveAmazonExportImageBaseUrl(req: Request): string {
  const fromRequest = resolvePublicAppBaseUrl({ req });
  try {
    const { hostname } = new URL(fromRequest);
    if (hostname.endsWith(".trycloudflare.com")) {
      return normalizeAmazonExportImageBaseUrl(fromRequest);
    }
  } catch {
    /* ignore */
  }

  const explicit = process.env.MARKETPLACE_PUBLISH_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit && !isLocalhostOrigin(explicit)) {
    return normalizeAmazonExportImageBaseUrl(explicit);
  }

  const configured = resolveConfiguredHttpsBaseUrl() ?? getConfiguredAppUrl();
  if (configured && !isLocalhostOrigin(configured)) {
    return normalizeAmazonExportImageBaseUrl(configured);
  }

  try {
    return normalizeAmazonExportImageBaseUrl(resolveMarketplacePublishBaseUrl(req));
  } catch {
    return normalizeAmazonExportImageBaseUrl(resolvePublicBaseUrl(req));
  }
}
