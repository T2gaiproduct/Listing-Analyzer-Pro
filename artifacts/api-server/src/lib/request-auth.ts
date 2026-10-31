import type { Request } from "express";
import { getAuth } from "@clerk/express";
import { getCloudPreviewAuthFromRequest } from "./cloud-preview-auth.js";
import { getNativeAuthFromRequest } from "./native-auth/session.js";
import { sessionEmailFromClaims } from "./session-email.js";

/** Resolved authenticated user id — Clerk session first, then native session. */
export function getRequestUserId(req: Request): string | null {
  const clerk = getAuth(req);
  if (clerk?.userId) return clerk.userId;
  const preview = getCloudPreviewAuthFromRequest(req);
  if (preview?.userId) return preview.userId;
  const native = getNativeAuthFromRequest(req);
  return native?.userId ?? null;
}

/** Email for invite/profile flows — Clerk claims, then native credential email. */
export function getRequestSessionEmail(req: Request): string | null {
  const clerk = getAuth(req);
  if (clerk?.userId) {
    const fromClaims = sessionEmailFromClaims(
      (clerk.sessionClaims ?? null) as Record<string, unknown> | null,
    );
    if (fromClaims) return fromClaims;
    const legacy = clerk.sessionClaims?.email;
    if (typeof legacy === "string" && legacy.trim()) return legacy.trim().toLowerCase();
  }
  const preview = getCloudPreviewAuthFromRequest(req);
  if (preview?.email) return preview.email.trim().toLowerCase();
  const native = getNativeAuthFromRequest(req);
  if (native?.email) return native.email.trim().toLowerCase();
  return null;
}
