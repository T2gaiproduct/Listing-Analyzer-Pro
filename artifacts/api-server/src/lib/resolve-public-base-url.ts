import fs from "node:fs";
import type { Request } from "express";
import { resolvePublicAppBaseUrl } from "./app-base-url.js";

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return true;
  }
}

function readDevTunnelPublicUrl(): string | undefined {
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

/** WooCommerce/Shopify must fetch images from a public HTTPS URL — never localhost. */
export function resolveMarketplacePublishBaseUrl(req: Request): string {
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
