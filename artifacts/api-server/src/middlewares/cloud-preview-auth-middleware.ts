import type { Request, Response, NextFunction } from "express";
import {
  isCloudPreviewSkipAuthEnabled,
  parseCloudPreviewBearer,
  setCloudPreviewAuthOnRequest,
  verifyCloudPreviewSessionToken,
} from "../lib/cloud-preview-auth.js";
import { getAuth } from "@clerk/express";

/** Attach preview test user when Bearer cpt_* token is valid (quick tunnel only). */
export function cloudPreviewAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!isCloudPreviewSkipAuthEnabled()) {
    next();
    return;
  }

  const clerk = getAuth(req);
  if (clerk?.userId) {
    next();
    return;
  }

  const token = parseCloudPreviewBearer(req);
  if (!token) {
    setCloudPreviewAuthOnRequest(req, null);
    next();
    return;
  }

  const ctx = verifyCloudPreviewSessionToken(token);
  setCloudPreviewAuthOnRequest(req, ctx);
  next();
}
