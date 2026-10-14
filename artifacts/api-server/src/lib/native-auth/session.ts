import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, authSessionsTable, authCredentialsTable } from "@workspace/db";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_DAYS,
  authCookieSecure,
  authSessionSecret,
} from "./config.js";

export type NativeAuthContext = {
  userId: string;
  email: string;
  sessionId: string;
};

const nativeAuthKey = Symbol("nativeAuth");

export function setNativeAuthOnRequest(req: Request, ctx: NativeAuthContext | null): void {
  (req as Request & { [nativeAuthKey]?: NativeAuthContext | null })[nativeAuthKey] = ctx;
}

export function getNativeAuthFromRequest(req: Request): NativeAuthContext | null {
  const v = (req as Request & { [nativeAuthKey]?: NativeAuthContext | null })[nativeAuthKey];
  return v ?? null;
}

function sessionTtlMs(): number {
  return AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000;
}

export async function createSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  await db.insert(authSessionsTable).values({ id: sessionId, userId, expiresAt });
  return { sessionId, expiresAt };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(authSessionsTable).where(eq(authSessionsTable.id, sessionId));
}

export async function resolveSession(sessionId: string): Promise<NativeAuthContext | null> {
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: authSessionsTable.id,
      userId: authSessionsTable.userId,
      email: authCredentialsTable.email,
    })
    .from(authSessionsTable)
    .innerJoin(authCredentialsTable, eq(authSessionsTable.userId, authCredentialsTable.userId))
    .where(and(eq(authSessionsTable.id, sessionId), gt(authSessionsTable.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  return { sessionId: row.sessionId, userId: row.userId, email: row.email };
}

export function parseBearerSessionToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token || token.includes(" ")) return null;
  return token;
}

export function readSessionCookie(req: Request): string | null {
  const raw = req.cookies?.[AUTH_SESSION_COOKIE];
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim();
}

export function setSessionCookie(res: Response, sessionId: string, expiresAt: Date): void {
  res.cookie(AUTH_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(AUTH_SESSION_COOKIE, {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: "lax",
    path: "/",
  });
}

export function signOAuthState(payload: string): string {
  const sig = createHmac("sha256", authSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = createHmac("sha256", authSessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

export function newUserId(): string {
  return `user_${randomBytes(12).toString("hex")}`;
}
