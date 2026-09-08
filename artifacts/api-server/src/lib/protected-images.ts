import type { Request, Response, NextFunction } from "express";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable, graphicsProjectsTable } from "@workspace/db";
import { GRAPHICS_IMAGES_DIR, resolveAuditImagePath } from "./image-storage";
import { getDefaultWorkspaceId } from "./ensure-workspaces.js";
import {
  assertProjectViewAccess,
  bootstrapAssetRequestContext,
  loadAuditForRequest,
} from "./workspace-route-helpers";

/** First path segment under /api/images served by express.static (not audit-owned files). */
export const PUBLIC_IMAGE_PATH_SEGMENTS = new Set([
  "heroes",
  "portfolio",
  "workflow",
  "avatars",
  "branding",
  "graphics",
]);

export async function requireAuditImageAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auditIdParam = String(req.params.auditId ?? "");

  // /api/images/:auditId/:filename is registered before express.static in the stack
  // history; reserved segments (heroes, portfolio, …) must fall through to static.
  if (PUBLIC_IMAGE_PATH_SEGMENTS.has(auditIdParam)) {
    next();
    return;
  }

  const auditId = parseInt(auditIdParam, 10);
  if (Number.isNaN(auditId)) {
    next();
    return;
  }

  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [audit] = await db
    .select({
      id: auditsTable.id,
      userId: auditsTable.userId,
      workspaceId: auditsTable.workspaceId,
    })
    .from(auditsTable)
    .where(and(eq(auditsTable.id, auditId), eq(auditsTable.isDeleted, 0)))
    .limit(1);

  if (!audit) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const workspaceId = audit.workspaceId ?? await getDefaultWorkspaceId(audit.userId);
  if (!(await bootstrapAssetRequestContext(req, userId, workspaceId, audit.userId))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const loaded = await loadAuditForRequest(req, auditId, "read");
  if (!loaded) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  next();
}

export async function requireGraphicsImageAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projectId = parseInt(String(req.params.projectId ?? ""), 10);
  if (Number.isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const [project] = await db
    .select({
      id: graphicsProjectsTable.id,
      userId: graphicsProjectsTable.userId,
      workspaceId: graphicsProjectsTable.workspaceId,
    })
    .from(graphicsProjectsTable)
    .where(and(eq(graphicsProjectsTable.id, projectId), eq(graphicsProjectsTable.isDeleted, 0)))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const workspaceId = project.workspaceId ?? await getDefaultWorkspaceId(project.userId);
  if (!(await bootstrapAssetRequestContext(req, userId, workspaceId, project.userId))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const allowed = await assertProjectViewAccess(req, ["graphics", "build_brand"], "graphics", projectId);
  if (!allowed) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  next();
}

export function sendAuditImage(req: Request, res: Response, next: NextFunction): void {
  const auditId = parseInt(String(req.params.auditId ?? ""), 10);
  const filename = String(req.params.filename ?? "");
  if (Number.isNaN(auditId) || !filename || filename.includes("..")) {
    next();
    return;
  }
  const resolved = resolveAuditImagePath(auditId, `/api/images/${auditId}/${filename}`);
  if (resolved) {
    res.sendFile(resolved);
    return;
  }
  next();
}

export function sendGraphicsImage(req: Request, res: Response): void {
  const projectId = String(req.params.projectId ?? "");
  const filename = path.basename(String(req.params.filename ?? ""));
  if (!projectId || !filename || filename.includes("..")) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.sendFile(path.join(GRAPHICS_IMAGES_DIR, projectId, filename), (err) => {
    if (err) res.status(404).json({ error: "Image not found" });
  });
}
