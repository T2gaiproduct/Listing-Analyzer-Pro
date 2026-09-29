import type { Request } from "express";
import { resolvePublicBaseUrl } from "./resolve-public-base-url.js";

export type EbayOAuthEnvironment = "sandbox" | "production";

export type EbayAppCredentials = {
  clientId: string;
  clientSecret: string;
  ruName: string;
};

export function parseEbayOAuthEnvironment(raw: unknown): EbayOAuthEnvironment {
  return raw === "production" ? "production" : "sandbox";
}

export function ebayOAuthDefaultEnvironment(): EbayOAuthEnvironment {
  const raw = process.env.EBAY_OAUTH_DEFAULT_ENV?.trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

function readCredentialsForEnv(environment: EbayOAuthEnvironment): EbayAppCredentials | null {
  const prefix = environment === "sandbox" ? "EBAY_SANDBOX_" : "EBAY_PRODUCTION_";
  const clientId = process.env[`${prefix}CLIENT_ID`]?.trim() ?? "";
  const clientSecret = process.env[`${prefix}CLIENT_SECRET`]?.trim() ?? "";
  const ruName = process.env[`${prefix}RUNAME`]?.trim() ?? "";
  if (!clientId || !clientSecret || !ruName) return null;
  return { clientId, clientSecret, ruName };
}

export function getEbayAppCredentials(environment: EbayOAuthEnvironment): EbayAppCredentials | null {
  return readCredentialsForEnv(environment);
}

export function isEbayOAuthAppConfigured(environment: EbayOAuthEnvironment): boolean {
  return getEbayAppCredentials(environment) != null;
}

export function ebayOAuthEndpoints(environment: EbayOAuthEnvironment): {
  authorizeUrl: string;
  tokenUrl: string;
  apiBaseUrl: string;
} {
  if (environment === "sandbox") {
    return {
      authorizeUrl: "https://auth.sandbox.ebay.com/oauth2/authorize",
      tokenUrl: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
      apiBaseUrl: "https://api.sandbox.ebay.com",
    };
  }
  return {
    authorizeUrl: "https://auth.ebay.com/oauth2/authorize",
    tokenUrl: "https://api.ebay.com/identity/v1/oauth2/token",
    apiBaseUrl: "https://api.ebay.com",
  };
}

/** Documented callback path; RuName in eBay Developer Portal must point at this URL on your public host. */
export function buildEbayOAuthCallbackUrl(req?: Request): string {
  const base = resolvePublicBaseUrl(req).replace(/\/$/, "");
  return `${base}/api/ebay/oauth/callback`;
}

export function describeEbayOAuthSetupIssue(environment: EbayOAuthEnvironment): string | null {
  const creds = getEbayAppCredentials(environment);
  if (creds) return null;
  const label = environment === "sandbox" ? "Sandbox" : "Production";
  return `${label} eBay app credentials are not configured on the server (EBAY_${environment === "sandbox" ? "SANDBOX" : "PRODUCTION"}_CLIENT_ID, CLIENT_SECRET, RUNAME).`;
}
