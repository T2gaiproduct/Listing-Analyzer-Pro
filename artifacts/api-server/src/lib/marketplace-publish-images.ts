import type { Request, Response } from "express";
import path from "node:path";
import { GRAPHICS_IMAGES_DIR, resolveAuditImagePath } from "./image-storage.js";
import { verifyPublishImageToken } from "./marketplace-publish-image-token.js";

export function sendMarketplacePublishAuditImage(req: Request, res: Response): void {
  const token = String(req.query.token ?? "");
  const verified = verifyPublishImageToken(token);
  if (!verified) {
    res.status(401).json({ error: "Invalid or expired image token" });
    return;
  }

  const auditId = Number.parseInt(String(req.params.auditId ?? ""), 10);
  const filename = path.basename(String(req.params.filename ?? ""));
  if (!Number.isFinite(auditId) || !filename || filename.includes("..")) {
    res.status(400).json({ error: "Invalid image path" });
    return;
  }
  if (verified.auditId !== auditId || verified.filename !== filename) {
    res.status(403).json({ error: "Image token mismatch" });
    return;
  }

  const resolved = resolveAuditImagePath(auditId, `/api/images/${auditId}/${filename}`);
  if (!resolved) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.sendFile(resolved);
}

export function sendMarketplacePublishGraphicsImage(req: Request, res: Response): void {
  const token = String(req.query.token ?? "");
  const verified = verifyPublishImageToken(token);
  if (!verified) {
    res.status(401).json({ error: "Invalid or expired image token" });
    return;
  }

  const projectId = Number.parseInt(String(req.params.projectId ?? ""), 10);
  const filename = path.basename(String(req.params.filename ?? ""));
  if (!Number.isFinite(projectId) || !filename || filename.includes("..")) {
    res.status(400).json({ error: "Invalid image path" });
    return;
  }
  if (verified.graphicsProjectId !== projectId || verified.filename !== filename) {
    res.status(403).json({ error: "Image token mismatch" });
    return;
  }

  const filePath = path.join(GRAPHICS_IMAGES_DIR, String(projectId), filename);
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ error: "Image not found" });
  });
}
