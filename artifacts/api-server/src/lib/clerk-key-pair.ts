import { logger } from "./logger.js";

export function clerkFrontendHostFromPublishableKey(publishableKey: string): string | null {
  const trimmed = publishableKey.trim();
  if (!trimmed.startsWith("pk_test_") && !trimmed.startsWith("pk_live_")) return null;
  const b64 = trimmed.replace(/^pk_(?:test|live)_/, "");
  const pad = (4 - (b64.length % 4)) % 4;
  try {
    return Buffer.from(`${b64}${"=".repeat(pad)}`, "base64").toString("utf8").replace(/\$$/, "");
  } catch {
    return null;
  }
}

/** True when publishable key and secret key belong to different Clerk instances (jwk-kid-mismatch). */
export async function checkClerkPublishableSecretPair(): Promise<
  "ok" | "mismatch" | "missing" | "skipped"
> {
  const publishable =
    process.env.CLERK_PUBLISHABLE_KEY?.trim() || process.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!publishable || !secret) return "missing";

  let secretKid: string | null = null;
  try {
    const resp = await fetch("https://api.clerk.com/v1/jwks", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!resp.ok) return "skipped";
    const data = (await resp.json()) as { keys?: Array<{ kid?: string }> };
    secretKid = data.keys?.find((k) => k.kid)?.kid ?? null;
  } catch {
    return "skipped";
  }
  if (!secretKid) return "skipped";

  const publishableHost = clerkFrontendHostFromPublishableKey(publishable);
  if (!publishableHost) return "skipped";

  try {
    const domainsResp = await fetch("https://api.clerk.com/v1/domains", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!domainsResp.ok) return "skipped";
    const domainsData = (await domainsResp.json()) as {
      data?: Array<{ accounts_portal_url?: string | null; frontend_api_url?: string | null }>;
    };
    const allowedHosts = new Set<string>();
    for (const domain of domainsData.data ?? []) {
      if (domain.frontend_api_url) {
        try {
          allowedHosts.add(new URL(domain.frontend_api_url).hostname);
        } catch {
          /* ignore */
        }
      }
      const portal = domain.accounts_portal_url?.trim();
      if (portal) {
        try {
          const slug = new URL(portal).hostname.split(".")[0];
          if (slug) allowedHosts.add(`${slug}.clerk.accounts.dev`);
        } catch {
          /* ignore */
        }
      }
    }
    allowedHosts.add(secretKid);
    if (allowedHosts.has(publishableHost)) return "ok";
    return "mismatch";
  } catch {
    return "skipped";
  }
}

export function clerkPublishableKeyFromFrontendApiHost(fapiHost: string): string {
  const payload = `${fapiHost.trim()}$`;
  return `pk_test_${Buffer.from(payload, "utf8").toString("base64").replace(/=+$/g, "")}`;
}

async function clerkFrontendApiHostFromSecret(secret: string): Promise<string | null> {
  try {
    const domainsResp = await fetch("https://api.clerk.com/v1/domains", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!domainsResp.ok) return null;
    const domainsData = (await domainsResp.json()) as {
      data?: Array<{
        is_satellite?: boolean;
        frontend_api_url?: string | null;
        accounts_portal_url?: string | null;
      }>;
    };
    for (const domain of domainsData.data ?? []) {
      if (domain.is_satellite) continue;
      const fe = domain.frontend_api_url?.trim();
      if (fe) {
        try {
          return new URL(fe).hostname;
        } catch {
          /* ignore */
        }
      }
      const portal = domain.accounts_portal_url?.trim();
      if (portal) {
        try {
          const slug = new URL(portal).hostname.split(".")[0];
          if (slug) return `${slug}.clerk.accounts.dev`;
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Cloud Agent / local dev: CLERK_SECRET_KEY and VITE_CLERK_PUBLISHABLE_KEY often come from
 * different Clerk apps → session JWT kid mismatch → 401 on /api/audits and /api/graphics.
 */
export async function ensureClerkPublishableMatchesSecret(): Promise<void> {
  if (process.env.DISABLE_CLERK_KEY_SYNC === "1") return;
  if (process.env.NODE_ENV === "production") return;

  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) return;

  const pair = await checkClerkPublishableSecretPair();
  if (pair !== "mismatch") return;

  const fapiHost = await clerkFrontendApiHostFromSecret(secret);
  if (!fapiHost) return;

  const fixed = clerkPublishableKeyFromFrontendApiHost(fapiHost);
  process.env.CLERK_PUBLISHABLE_KEY = fixed;
  logger.warn(
    { fapiHost },
    "Clerk publishable key did not match CLERK_SECRET_KEY; synced CLERK_PUBLISHABLE_KEY for this API process (rebuild frontend with the same pk_test or update env secrets)",
  );
}
