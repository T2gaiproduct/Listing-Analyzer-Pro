import crypto from "node:crypto";
import type { WalmartEnvironment } from "./walmart-oauth.js";
import { oauthStateSecret } from "./amazon-sp-api.js";

export type WalmartOAuthStatePayload = {
  userId: string;
  workspaceId: number | null;
  environment: WalmartEnvironment;
  ts: number;
};

export function createWalmartOAuthState(input: {
  userId: string;
  workspaceId?: number | null;
  environment: WalmartEnvironment;
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

export function parseWalmartOAuthState(state: string): Omit<WalmartOAuthStatePayload, "ts"> | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as WalmartOAuthStatePayload;
    if (!data.userId || !data.ts) return null;
    if (Date.now() - data.ts > 30 * 60 * 1000) return null;
    const environment = data.environment === "sandbox" ? "sandbox" : "production";
    return {
      userId: data.userId,
      workspaceId: typeof data.workspaceId === "number" ? data.workspaceId : null,
      environment,
    };
  } catch {
    return null;
  }
}
