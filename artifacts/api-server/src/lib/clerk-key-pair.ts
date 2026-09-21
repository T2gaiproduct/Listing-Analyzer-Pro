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
