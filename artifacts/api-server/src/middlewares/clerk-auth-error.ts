import type { Request, Response, NextFunction } from "express";
import { clerkMiddleware } from "@clerk/express";
import type { ClerkMiddlewareOptions, ClerkMiddlewareOptionsCallback } from "@clerk/express";

function isInvalidSessionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name?.toLowerCase() ?? "";
  const message = err.message.toLowerCase();
  if (name.includes("jwt") || name.includes("jws") || name.includes("jwe")) return true;
  if (message.includes("jwt") || message.includes("session") || message.includes("token")) return true;
  if (message.includes("unexpected end of data") || message.includes("invalid compact")) return true;
  if (message.includes("signature") && message.includes("verif")) return true;
  return false;
}

/** Clerk middleware that maps broken session cookies/JWTs to 401 instead of 500. */
export function clerkMiddlewareSafe(
  options: ClerkMiddlewareOptions | ClerkMiddlewareOptionsCallback = {},
): ReturnType<typeof clerkMiddleware> {
  const inner = clerkMiddleware(options);
  return (req: Request, res: Response, next: NextFunction) => {
    inner(req, res, (err?: unknown) => {
      if (err) {
        if (isInvalidSessionError(err)) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        next(err);
        return;
      }
      next();
    });
  };
}
