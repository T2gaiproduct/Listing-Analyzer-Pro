import type { Request } from "express";
import { resolvePublicBaseUrl } from "./resolve-public-base-url.js";
import type { WalmartEnvironment } from "./walmart-oauth.js";

export type WalmartAppCredentials = {
  clientId: string;
  clientSecret: string;
};

/**
 * Reads WALMART_OAUTH_DEFAULT_ENV: sandbox → sandbox API + login; production (or unset) → production.
 * Accepts common aliases; misspelling "sandox" maps to sandbox.
 */
export function parseWalmartOAuthDefaultEnvironment(raw: string | undefined): WalmartEnvironment {
  const normalized = raw?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return "production";
  }
  if (
    normalized === "sandbox"
    || normalized === "sandox"
    || normalized === "sb"
    || normalized === "test"
  ) {
    return "sandbox";
  }
  if (
    normalized === "production"
    || normalized === "prod"
    || normalized === "live"
  ) {
    return "production";
  }
  return "production";
}

export function walmartOAuthDefaultEnvironment(): WalmartEnvironment {
  return parseWalmartOAuthDefaultEnvironment(process.env.WALMART_OAUTH_DEFAULT_ENV);
}

/** Which credential prefix is active for OAuth on this deployment. */
export function activeWalmartOAuthCredentialPrefix(): "WALMART_SANDBOX_" | "WALMART_PRODUCTION_" {
  return walmartOAuthDefaultEnvironment() === "sandbox" ? "WALMART_SANDBOX_" : "WALMART_PRODUCTION_";
}

function readCredentialsForEnv(environment: WalmartEnvironment): WalmartAppCredentials | null {
  const prefix = environment === "sandbox" ? "WALMART_SANDBOX_" : "WALMART_PRODUCTION_";
  const clientId = process.env[`${prefix}CLIENT_ID`]?.trim() ?? "";
  const clientSecret = process.env[`${prefix}CLIENT_SECRET`]?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getWalmartAppCredentials(environment: WalmartEnvironment): WalmartAppCredentials | null {
  return readCredentialsForEnv(environment);
}

export function isWalmartOAuthAppConfigured(environment: WalmartEnvironment): boolean {
  return getWalmartAppCredentials(environment) != null;
}

export function walmartOAuthAuthorizeUrl(environment: WalmartEnvironment): string {
  return environment === "sandbox"
    ? "https://login.sandbox.account.wal-mart.com/authorize"
    : "https://login.account.wal-mart.com/authorize";
}

/** Registered Auth Callback URL in the Walmart Developer Portal. */
export function buildWalmartOAuthCallbackUrl(req: Request): string {
  const base = resolvePublicBaseUrl(req).replace(/\/$/, "");
  return `${base}/api/walmart/oauth/callback`;
}

export function describeWalmartOAuthSetupIssue(environment: WalmartEnvironment): string | null {
  const creds = getWalmartAppCredentials(environment);
  if (creds) return null;
  const label = environment === "sandbox" ? "Sandbox" : "Production";
  return `${label} Walmart app credentials are not configured on the server (WALMART_${environment === "sandbox" ? "SANDBOX" : "PRODUCTION"}_CLIENT_ID, CLIENT_SECRET).`;
}

export function resolveActiveWalmartOAuthEnvironment(): WalmartEnvironment | null {
  const env = walmartOAuthDefaultEnvironment();
  return isWalmartOAuthAppConfigured(env) ? env : null;
}

export function isWalmartOAuthConnectReady(): boolean {
  return resolveActiveWalmartOAuthEnvironment() != null;
}

export function walmartConnectUnavailableMessageForSellers(): string {
  return "Walmart connect is not available on this site yet. Please try again later or contact support.";
}
