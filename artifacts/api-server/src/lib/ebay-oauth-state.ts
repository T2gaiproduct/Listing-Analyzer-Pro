import crypto from "node:crypto";
import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { oauthStateSecret } from "./amazon-sp-api.js";

export type EbayOAuthStatePayload = {
  userId: string;
  workspaceId: number | null;
  environment: EbayOAuthEnvironment;
  ts: number;
};

export function createEbayOAuthState(input: {
  userId: string;
  workspaceId?: number | null;
  environment: EbayOAuthEnvironment;
}): string {
  const payload = Buffer.from(JSON.stringify({
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    environment: input.environment,
    ts: Date.now(),
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function parseEbayOAuthState(state: string): Omit<EbayOAuthStatePayload, "ts"> | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as EbayOAuthStatePayload;
    if (!data.userId || !data.ts) return null;
    if (Date.now() - data.ts > 30 * 60 * 1000) return null;
    const environment = data.environment === "production" ? "production" : "sandbox";
    return {
      userId: data.userId,
      workspaceId: typeof data.workspaceId === "number" ? data.workspaceId : null,
      environment,
    };
  } catch {
    return null;
  }
}
