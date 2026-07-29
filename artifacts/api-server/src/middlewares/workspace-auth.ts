import type { Request, Response, NextFunction } from "express";
import {
  resolveWorkspaceContext,
  WORKSPACE_HEADER,
  type WorkspaceContext,
} from "../lib/workspace-context";

export interface WorkspaceAuthedRequest extends Request {
  userId: string;
  workspace: WorkspaceContext;
}

export async function resolveWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = (req as { userId?: string }).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const headerVal = req.get(WORKSPACE_HEADER) ?? req.get("X-Workspace-Id");
  const queryVal = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const workspaceId = headerVal ?? queryVal;

  const ctx = await resolveWorkspaceContext(userId, workspaceId);
  if (!ctx) {
    res.status(403).json({ error: "Workspace not found or access denied" });
    return;
  }

  (req as WorkspaceAuthedRequest).workspace = ctx;
  next();
}

export function getWorkspaceId(req: Request): number {
  return (req as WorkspaceAuthedRequest).workspace.workspaceId;
}

export function getWorkspaceOwnerId(req: Request): string {
  return (req as WorkspaceAuthedRequest).workspace.accountOwnerId;
}
