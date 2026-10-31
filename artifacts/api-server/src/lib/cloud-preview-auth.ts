import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { isCloudAgentQuickTunnelHostname } from "./cloud-agent-quick-tunnel.js";
import { authSessionSecret } from "./native-auth/config.js";

const previewAuthKey = Symbol("cloudPreviewAuth");

export type CloudPreviewAuthContext = {
  userId: string;
  email: string;
};

/** Opt-in testing bypass — only dev-stack quick tunnel + local Postgres. */
export function isCloudPreviewSkipAuthEnabled(): boolean {
  if (process.env.CLOUD_PREVIEW_SKIP_AUTH !== "true") return false;
  if (process.env.ENABLE_CLOUD_AGENT_QUICK_TUNNEL !== "true") return false;
  if (process.env.NODE_ENV === "production") return false;
  const db = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(db)) return false;
  return true;
}

export function previewAuthUserIdFromEnv(): string | null {
  const ids = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids[0] ?? null;
}

export function isCloudPreviewSessionRequest(req: Request): boolean {
  const host = (req.headers.host ?? "").split(":")[0]?.toLowerCase() ?? "";
  return isCloudAgentQuickTunnelHostname(host);
}

export function setCloudPreviewAuthOnRequest(
  req: Request,
  ctx: CloudPreviewAuthContext | null,
): void {
  (req as Request & { [previewAuthKey]?: CloudPreviewAuthContext | null })[previewAuthKey] = ctx;
}

export function getCloudPreviewAuthFromRequest(req: Request): CloudPreviewAuthContext | null {
  const v = (req as Request & { [previewAuthKey]?: CloudPreviewAuthContext | null })[previewAuthKey];
  return v ?? null;
}

const TOKEN_PREFIX = "cpt_";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function signPreviewPayload(payload: string): string {
  const sig = createHmac("sha256", authSessionSecret()).update(payload).digest("base64url");
  return `${TOKEN_PREFIX}${payload}.${sig}`;
}

export function mintCloudPreviewSessionToken(userId: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const nonce = randomBytes(8).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ userId, exp, nonce }), "utf8").toString("base64url");
  return signPreviewPayload(payload);
}

export function verifyCloudPreviewSessionToken(token: string): CloudPreviewAuthContext | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const signed = token.slice(TOKEN_PREFIX.length);
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = createHmac("sha256", authSessionSecret()).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let parsed: { userId?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      userId?: string;
      exp?: number;
    };
  } catch {
    return null;
  }
  const userId = parsed.userId?.trim();
  const exp = parsed.exp;
  if (!userId || typeof exp !== "number" || exp < Date.now()) return null;

  const allowed = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(userId)) return null;

  return {
    userId,
    email: `preview+${userId.slice(-8)}@cloud-preview.local`,
  };
}

export function parseCloudPreviewBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  return token;
}
