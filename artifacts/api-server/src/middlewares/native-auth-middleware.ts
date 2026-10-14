import type { Request, Response, NextFunction } from "express";
import { isNativeAuthEnabled } from "../lib/native-auth/config.js";
import {
  parseBearerSessionToken,
  readSessionCookie,
  resolveSession,
  setNativeAuthOnRequest,
} from "../lib/native-auth/session.js";

/** Attach native session to req when NATIVE_AUTH_ENABLED and no Clerk user yet. */
export function nativeAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!isNativeAuthEnabled()) {
    next();
    return;
  }

  void (async () => {
    try {
      const token = parseBearerSessionToken(req) ?? readSessionCookie(req);
      if (!token) {
        setNativeAuthOnRequest(req, null);
        next();
        return;
      }
      const ctx = await resolveSession(token);
      setNativeAuthOnRequest(req, ctx);
      next();
    } catch {
      setNativeAuthOnRequest(req, null);
      next();
    }
  })();
}
