import type { ClerkMiddlewareOptions } from "@clerk/express";
import type { Request } from "express";
import { getAllowedOrigins } from "./allowed-origins.js";
import { isCloudAgentQuickTunnelHostname } from "./cloud-agent-quick-tunnel.js";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware.js";

export function clerkPublishableKeyFromEnv(): string | undefined {
  return (
    process.env.CLERK_PUBLISHABLE_KEY?.trim()
    || process.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()
    || undefined
  );
}

function previewTunnelOrigin(req: Request): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const host = getClerkProxyHost(req) ?? req.headers.host;
  const hostname = typeof host === "string" ? host.split(",")[0]!.trim().split(":")[0] : "";
  if (!isCloudAgentQuickTunnelHostname(hostname)) return null;
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || "https";
  return `${proto}://${hostname}`;
}

/** Clerk JWT `azp` must match an entry when authorizedParties is set (Cloudflare preview URLs). */
export function clerkMiddlewareOptionsForRequest(req: Request): ClerkMiddlewareOptions {
  const parties = new Set<string>(getAllowedOrigins());

  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.trim()) {
    parties.add(origin.trim());
  }

  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.trim()) {
    try {
      parties.add(new URL(referer).origin);
    } catch {
      /* ignore invalid referer */
    }
  }

  const host = getClerkProxyHost(req);
  if (host) {
    const protoHeader = req.headers["x-forwarded-proto"];
    const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || req.protocol || "https";
    const hostname = host.split(",")[0]!.trim();
    parties.add(`${proto}://${hostname}`);
    if (!hostname.includes(":") && process.env.NODE_ENV !== "production") {
      parties.add(`${proto}://${hostname}:443`);
    }
  }

  const previewOrigin = previewTunnelOrigin(req);
  if (previewOrigin) {
    parties.add(previewOrigin);
  }

  const options: ClerkMiddlewareOptions = {
    publishableKey: clerkPublishableKeyFromEnv(),
    secretKey: process.env.CLERK_SECRET_KEY,
  };

  // Quick Cloudflare tunnels get a new hostname each run; strict azp lists break Bearer auth on /api/profile.
  if (process.env.NODE_ENV === "production") {
    options.authorizedParties = [...parties];
  }

  return options;
}
