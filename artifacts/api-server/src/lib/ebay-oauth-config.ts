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

/** When true, OAuth always uses Sandbox credentials (recommended on staging hosts). */
export function isEbayStagingSandboxOnly(): boolean {
  const raw = process.env.EBAY_STAGING_SANDBOX_ONLY?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Environment used for connect after applying EBAY_STAGING_SANDBOX_ONLY. */
export function ebayOAuthEffectiveEnvironment(): EbayOAuthEnvironment {
  if (isEbayStagingSandboxOnly()) return "sandbox";
  return ebayOAuthDefaultEnvironment();
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
export function buildEbayOAuthCallbackUrl(req: Request): string {
  const base = resolvePublicBaseUrl(req).replace(/\/$/, "");
  return `${base}/api/ebay/oauth/callback`;
}

export function describeEbayOAuthSetupIssue(environment: EbayOAuthEnvironment): string | null {
  const creds = getEbayAppCredentials(environment);
  if (creds) return null;
  const label = environment === "sandbox" ? "Sandbox" : "Production";
  return `${label} eBay app credentials are not configured on the server (EBAY_${environment === "sandbox" ? "SANDBOX" : "PRODUCTION"}_CLIENT_ID, CLIENT_SECRET, RUNAME).`;
}

/** Environment used for OAuth on this deployment (from EBAY_OAUTH_DEFAULT_ENV). */
export function resolveActiveEbayOAuthEnvironment(): EbayOAuthEnvironment | null {
  const env = ebayOAuthEffectiveEnvironment();
  return isEbayOAuthAppConfigured(env) ? env : null;
}

export type EbayOAuthPublicDiagnostics = {
  configuredDefaultEnv: EbayOAuthEnvironment;
  effectiveEnv: EbayOAuthEnvironment;
  stagingSandboxOnly: boolean;
  sandboxConfigured: boolean;
  productionConfigured: boolean;
  authorizeHost: string;
  tokenHost: string;
};

export function getEbayOAuthPublicDiagnostics(): EbayOAuthPublicDiagnostics {
  const effectiveEnv = ebayOAuthEffectiveEnvironment();
  const endpoints = ebayOAuthEndpoints(effectiveEnv);
  let authorizeHost = "unknown";
  let tokenHost = "unknown";
  try {
    authorizeHost = new URL(endpoints.authorizeUrl).host;
    tokenHost = new URL(endpoints.tokenUrl).host;
  } catch {
    // ignore
  }
  return {
    configuredDefaultEnv: ebayOAuthDefaultEnvironment(),
    effectiveEnv,
    stagingSandboxOnly: isEbayStagingSandboxOnly(),
    sandboxConfigured: isEbayOAuthAppConfigured("sandbox"),
    productionConfigured: isEbayOAuthAppConfigured("production"),
    authorizeHost,
    tokenHost,
  };
}

export function isEbayOAuthConnectReady(): boolean {
  return resolveActiveEbayOAuthEnvironment() != null;
}

/** Shown to sellers when the platform has not configured eBay OAuth on this host. */
export function ebayConnectUnavailableMessageForSellers(): string {
  return "eBay connect is not available on this site yet. Please try again later or contact support.";
}
