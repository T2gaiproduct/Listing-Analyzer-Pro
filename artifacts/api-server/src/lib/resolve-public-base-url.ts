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
  const raw = process.env.CLOUDFLARE_TUNNEL_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (raw?.startsWith("https://")) return raw;
  return undefined;
}

function readDevTunnelPublicUrl(): string | undefined {
  const stable = readStableTunnelPublicUrl();
  if (stable) return stable;

  try {
    const raw = fs.readFileSync("/tmp/public-url.txt", "utf8");
    const line = raw
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("https://") && entry.includes("trycloudflare.com"));
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
