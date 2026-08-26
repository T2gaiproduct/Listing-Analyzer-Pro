import type { ClerkMiddlewareOptions } from "@clerk/express";
import type { Request } from "express";
import { getAllowedOrigins } from "./allowed-origins.js";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware.js";

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
    parties.add(`${proto}://${host}`);
  }

  return {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    authorizedParties: [...parties],
  };
}
