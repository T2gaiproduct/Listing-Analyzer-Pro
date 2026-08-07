import { and, eq } from "drizzle-orm";
import type { Request } from "express";
import { getAuth } from "@clerk/express";
import { db, auditsTable, graphicsProjectsTable } from "@workspace/db";
import type { TeamAuthedRequest } from "../middlewares/team-auth.js";
import {
  getAccountOwnerId,
  getActiveWorkspaceId,
  getWorkspaceCtx,
  loadWorkedProjects,
  viewOwnIdFilter,
  workspaceOwnerFilter,
} from "./workspace-route-helpers.js";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

interface AuthedRequest extends Request {
  userId: string;
}

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

function getEffectiveUserId(req: Request): string {
  if ((req as { workspace?: unknown }).workspace) return getAccountOwnerId(req);
  const team = (req as TeamAuthedRequest).team;
  const auth = getAuth(req);
  return team?.ownerUserId ?? auth?.userId ?? (req as AuthedRequest).userId;
}

async function auditScopeWhere(req: Request, extra?: ReturnType<typeof and>) {
  const ownerId = getEffectiveUserId(req);
  const workspaceId = getActiveWorkspaceId(req);
  const worked = await loadWorkedProjects(req);
  const ownFilter = viewOwnIdFilter(getWorkspaceCtx(req), "audits", worked, "audit", auditsTable);
  return and(
    workspaceOwnerFilter(auditsTable, auditsTable, ownerId, workspaceId),
    eq(auditsTable.isDeleted, 0),
    ownFilter,
    extra,
  );
}

export async function loadAuditForExport(req: Request, auditId: number) {
  const auth = getAuth(req);
  const userId = auth?.userId ?? (req as AuthedRequest).userId;
  const whereClause = isAdmin(userId)
    ? and(eq(auditsTable.id, auditId), eq(auditsTable.isDeleted, 0))
    : await auditScopeWhere(req, eq(auditsTable.id, auditId));

  const [audit] = await db.select().from(auditsTable).where(whereClause).limit(1);
  if (!audit) return null;

  const [graphicsProject] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(and(
      eq(graphicsProjectsTable.auditId, auditId),
      eq(graphicsProjectsTable.isDeleted, 0),
    ))
    .limit(1);

  return { audit, graphicsProject: graphicsProject ?? null };
}
