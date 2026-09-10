import type { Request, Response, NextFunction } from "express";
import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { WorkspaceFeature } from "@workspace/workspace-permissions";
import { ownerPermissions } from "@workspace/workspace-permissions";
import { db, auditsTable, graphicsProjectsTable } from "@workspace/db";
import { resolveTeamContext, type TeamAuthedRequest } from "../middlewares/team-auth";
import { resolveWorkspace, type WorkspaceAuthedRequest } from "../middlewares/workspace-auth";
import { WORKSPACE_HEADER } from "./workspace-context";
import {
  canViewInWorkspace,
  canWriteInWorkspace,
  requireWorkspacePerm,
  workspacePermOpts,
  type WorkspaceContext,
  resolveWorkspaceContext,
} from "./workspace-context";
import { getDefaultWorkspaceId, ensureSubscriberDefaultWorkspace } from "./ensure-workspaces.js";
import {
  getMemberWorkedProjects,
  memberHasProjectAccess,
  type MemberWorkedProjects,
  type WorkedProjectType,
} from "./member-projects";

interface AuthedRequest extends Request {
  userId: string;
}

export type WorkspaceScopedRequest = AuthedRequest & TeamAuthedRequest & WorkspaceAuthedRequest;

/** Resolve team + active workspace (header/query or default). */
export async function resolveTeamAndWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;
  if (!team.isTeamMember) {
    await ensureSubscriberDefaultWorkspace(team.ownerUserId);
  }
  await resolveWorkspace(req, res, next);
}

/** Dashboard account overview: allow billing owners without x-workspace-id. */
export async function resolveTeamAndDashboardScope(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;

  const ownerId = team.ownerUserId;
  const headerVal = req.get(WORKSPACE_HEADER) ?? req.get("X-Workspace-Id");
  const queryWorkspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const hasExplicitWorkspace = Boolean(headerVal || queryWorkspaceId);
  const accountScope = req.query.scope === "account";
  const billingOwner = !team.isTeamMember && userId === ownerId;

  if (billingOwner && (accountScope || !hasExplicitWorkspace)) {
    await ensureSubscriberDefaultWorkspace(ownerId);
    const defaultId = await getDefaultWorkspaceId(ownerId);
    if (defaultId) {
      const ctx = await resolveWorkspaceContext(userId, defaultId);
      if (ctx) {
        (req as WorkspaceAuthedRequest).workspace = ctx;
        next();
        return;
      }
    }
    (req as WorkspaceAuthedRequest).workspace = {
      workspaceId: defaultId ?? 0,
      workspaceName: "Account",
      accountOwnerId: ownerId,
      isAccountOwner: true,
      isDefault: true,
      permissions: ownerPermissions(),
      legacyRole: "owner",
      preserveLegacyPermissions: true,
      useLegacy: false,
      team,
    };
    next();
    return;
  }

  await resolveWorkspace(req, res, next);
}

export function getWorkspaceCtx(req: Request): WorkspaceContext {
  return (req as WorkspaceAuthedRequest).workspace;
}

export function getAccountOwnerId(req: Request): string {
  return getWorkspaceCtx(req).accountOwnerId;
}

export function getActiveWorkspaceId(req: Request): number {
  return getWorkspaceCtx(req).workspaceId;
}

/** Billing owner rollup: all workspaces (no x-workspace-id or scope=account). */
export function isBillingOwnerAccountOverview(req: Request): boolean {
  const userId = (req as AuthedRequest).userId;
  if (!userId) return false;
  const wsCtx = getWorkspaceCtx(req);
  const team = (req as TeamAuthedRequest).team;
  const ownerId = wsCtx.accountOwnerId;
  const hasExplicitWorkspace = Boolean(req.get(WORKSPACE_HEADER) ?? req.get("X-Workspace-Id"));
  const accountScope = req.query.scope === "account";
  return wsCtx.isAccountOwner
    && userId === ownerId
    && !team?.isTeamMember
    && (accountScope || !hasExplicitWorkspace);
}

/** Workspace id for list feeds; null = all workspaces (account overview). */
export function getListScopeWorkspaceId(req: Request): number | null {
  return isBillingOwnerAccountOverview(req) ? null : getActiveWorkspaceId(req);
}

export function requireWorkspaceAction(
  feature: WorkspaceFeature,
  action: "create" | "edit" | "delete",
) {
  return requireWorkspaceActionAny([feature], action);
}

export function requireWorkspaceActionAny(
  features: WorkspaceFeature[],
  action: "create" | "edit" | "delete",
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = getWorkspaceCtx(req);
    if (ctx.isAccountOwner) {
      next();
      return;
    }
    const opts = workspacePermOpts(ctx);
    for (const feature of features) {
      if (canWriteInWorkspace(ctx.permissions, feature, action, opts)) {
        next();
        return;
      }
    }
    res.status(403).json({ error: "Forbidden: insufficient workspace permission" });
  };
}

export function requireWorkspaceView(feature: WorkspaceFeature) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = getWorkspaceCtx(req);
    if (ctx.isAccountOwner || requireWorkspacePerm(ctx, feature, "viewGlobal") || requireWorkspacePerm(ctx, feature, "viewOwn")) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden: insufficient workspace permission" });
  };
}

/** Clerk user id of the workspace member who created a project (null for account owners). */
export function memberCreatedByUserId(req: Request): string | null {
  const actorId = (req as AuthedRequest).userId;
  const ownerId = getAccountOwnerId(req);
  if (actorId === ownerId) return null;
  return actorId;
}

export async function loadWorkedProjects(req: Request): Promise<MemberWorkedProjects | null> {
  const ctx = getWorkspaceCtx(req);
  const userId = (req as AuthedRequest).userId;
  if (ctx.isAccountOwner) return null;
  return getMemberWorkedProjects(userId, ctx.team, {
    workspaceId: ctx.workspaceId,
    workspaceMemberId: ctx.workspaceMemberId,
  });
}

/**
 * Attach team + workspace to req for protected asset routes.
 * Browser <img> requests do not send x-workspace-id, so resolve workspace from the asset row.
 */
export async function bootstrapAssetRequestContext(
  req: Request,
  userId: string,
  workspaceId: number | null | undefined,
  accountOwnerId?: string,
): Promise<boolean> {
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;
  (req as AuthedRequest).userId = userId;

  let wsId = workspaceId ?? null;
  if (wsId == null) {
    const owner = accountOwnerId ?? team.ownerUserId;
    wsId = await getDefaultWorkspaceId(owner);
  }
  if (!wsId) return false;

  const workspace = await resolveWorkspaceContext(userId, wsId);
  if (!workspace) return false;
  (req as WorkspaceAuthedRequest).workspace = workspace;
  return true;
}

function workedIds(worked: MemberWorkedProjects | null, type: WorkedProjectType): number[] {
  if (!worked) return [];
  switch (type) {
    case "audit": return worked.auditIds;
    case "graphics": return worked.graphicsIds;
    case "video": return worked.videoIds;
    case "ads": return worked.adsIds;
    default: return [];
  }
}

/** Restrict list queries when user only has viewOwn (not viewGlobal). */
export function viewOwnIdFilter(
  ctx: WorkspaceContext,
  feature: WorkspaceFeature,
  worked: MemberWorkedProjects | null,
  type: WorkedProjectType,
  idColumn: { id: unknown },
): SQL | undefined {
  return viewOwnIdFilterAny(ctx, [feature], worked, type, idColumn);
}

/** Same as viewOwnIdFilter but accepts any of the listed features (e.g. build_brand + graphics). */
export function viewOwnIdFilterAny(
  ctx: WorkspaceContext,
  features: WorkspaceFeature[],
  worked: MemberWorkedProjects | null,
  type: WorkedProjectType,
  idColumn: { id: unknown },
): SQL | undefined {
  if (ctx.isAccountOwner) return undefined;
  for (const feature of features) {
    if (requireWorkspacePerm(ctx, feature, "viewGlobal")) return undefined;
  }
  const hasViewOwn = features.some((feature) => requireWorkspacePerm(ctx, feature, "viewOwn"));
  if (!hasViewOwn) return sql`false`;
  const ids = workedIds(worked, type);
  if (ids.length === 0) return sql`false`;
  return inArray(idColumn.id as never, ids);
}

export async function assertProjectViewAccess(
  req: Request,
  feature: WorkspaceFeature | WorkspaceFeature[],
  type: WorkedProjectType,
  projectId: number,
): Promise<boolean> {
  const ctx = getWorkspaceCtx(req);
  const userId = (req as AuthedRequest).userId;
  if (ctx.isAccountOwner) return true;
  const features = Array.isArray(feature) ? feature : [feature];
  for (const f of features) {
    if (requireWorkspacePerm(ctx, f, "viewGlobal")) return true;
  }
  if (!features.some((f) => requireWorkspacePerm(ctx, f, "viewOwn"))) return false;
  const worked = await loadWorkedProjects(req);
  if (worked && memberHasProjectAccess(worked, type, projectId)) return true;

  if (type === "graphics") {
    const [row] = await db
      .select({
        createdByUserId: graphicsProjectsTable.createdByUserId,
        auditId: graphicsProjectsTable.auditId,
      })
      .from(graphicsProjectsTable)
      .where(eq(graphicsProjectsTable.id, projectId))
      .limit(1);
    if (row?.createdByUserId === userId) return true;
    if (row?.auditId != null && worked?.auditIds.includes(row.auditId)) return true;
  }

  return false;
}

export function canViewFeature(ctx: WorkspaceContext, feature: WorkspaceFeature, isCreator = false): boolean {
  if (ctx.isAccountOwner) return true;
  return canViewInWorkspace(ctx.permissions, feature, { ...workspacePermOpts(ctx), isCreator });
}

export function buildTeamAwareCreditCtx(req: Request): import("./credits.js").TeamAwareContext {
  const team = (req as TeamAuthedRequest).team;
  const userId = (req as AuthedRequest).userId;
  const ws = getWorkspaceCtx(req);
  return {
    userId,
    memberId: team?.memberId,
    ownerUserId: team?.ownerUserId,
    isTeamMember: team?.isTeamMember ?? false,
    workspaceId: ws.workspaceId,
    workspaceMemberId: ws.workspaceMemberId,
    isAccountOwner: ws.isAccountOwner,
    isDefaultWorkspace: ws.isDefault,
  };
}

export function workspaceOwnerFilter(
  ownerColumn: { userId: unknown },
  workspaceColumn: { workspaceId: unknown },
  ownerId: string,
  workspaceId: number,
): SQL {
  return and(
    eq(ownerColumn.userId as never, ownerId),
    eq(workspaceColumn.workspaceId as never, workspaceId),
  )!;
}

/** All projects for an account owner, or scoped to one workspace when workspaceId is set. */
export function ownerProjectFilter(
  ownerColumn: { userId: unknown },
  workspaceColumn: { workspaceId: unknown },
  ownerId: string,
  workspaceId: number | null,
): SQL {
  if (workspaceId == null) {
    return eq(ownerColumn.userId as never, ownerId);
  }
  return workspaceOwnerFilter(ownerColumn, workspaceColumn, ownerId, workspaceId);
}

const AUDIT_SCOPE_FEATURES: WorkspaceFeature[] = ["audits", "build_brand"];
const GRAPHICS_SCOPE_FEATURES: WorkspaceFeature[] = ["graphics", "build_brand"];

export type AuditAccessMode = "read" | "write";

/** Workspace filter for graphics lists; members can always see projects they created. */
export function graphicsWorkspaceScopeFilter(
  req: Request,
  ownerId: string,
  workspaceId: number,
  ownerColumn: { userId: unknown },
  workspaceColumn: { workspaceId: unknown },
): SQL {
  const legacyNullWorkspace = and(
    eq(ownerColumn.userId as never, ownerId),
    isNull(workspaceColumn.workspaceId as never),
  )!;
  const scoped = and(
    eq(ownerColumn.userId as never, ownerId),
    eq(workspaceColumn.workspaceId as never, workspaceId),
  )!;
  const ctx = getWorkspaceCtx(req);
  if (ctx.isAccountOwner) {
    return or(scoped, legacyNullWorkspace)!;
  }
  const userId = (req as AuthedRequest).userId;
  return or(
    scoped,
    legacyNullWorkspace,
    and(
      eq(ownerColumn.userId as never, ownerId),
      eq(graphicsProjectsTable.createdByUserId, userId),
    ),
  )!;
}

/** Load one graphics project with workspace RBAC (members retain access to projects they created). */
export async function loadGraphicsProjectForRequest(
  req: Request,
  projectId: number,
): Promise<typeof graphicsProjectsTable.$inferSelect | null> {
  const ctx = getWorkspaceCtx(req);
  const userId = (req as AuthedRequest).userId;
  const ownerId = getAccountOwnerId(req);
  const workspaceId = getActiveWorkspaceId(req);

  const [project] = await db
    .select()
    .from(graphicsProjectsTable)
    .where(
      and(
        eq(graphicsProjectsTable.id, projectId),
        eq(graphicsProjectsTable.isDeleted, 0),
        or(
          eq(graphicsProjectsTable.userId, ownerId),
          eq(graphicsProjectsTable.createdByUserId, userId),
        ),
      ),
    )
    .limit(1);

  if (!project) return null;

  const workspaceAllowed =
    project.workspaceId === workspaceId
    || project.workspaceId == null
    || project.createdByUserId === userId;
  if (!workspaceAllowed) return null;

  if (ctx.isAccountOwner) return project;

  for (const feature of GRAPHICS_SCOPE_FEATURES) {
    if (requireWorkspacePerm(ctx, feature, "viewGlobal")) return project;
  }

  if (project.createdByUserId === userId) return project;

  const worked = await loadWorkedProjects(req);
  if (worked && memberHasProjectAccess(worked, "graphics", projectId)) return project;
  if (project.auditId != null && worked?.auditIds.includes(project.auditId)) return project;

  if (project.auditId != null) {
    const audit =
      await loadAuditForRequest(req, project.auditId, "write")
      ?? await loadAuditForRequest(req, project.auditId, "read");
    if (audit) return project;

    // Build-brand workflow: members with edit can generate on audit-linked projects in scope.
    for (const feature of GRAPHICS_SCOPE_FEATURES) {
      if (!requireWorkspacePerm(ctx, feature, "edit")) continue;
      const [scopedAudit] = await db
        .select({ id: auditsTable.id })
        .from(auditsTable)
        .where(
          and(
            eq(auditsTable.id, project.auditId),
            eq(auditsTable.userId, ownerId),
            eq(auditsTable.isDeleted, 0),
            or(
              eq(auditsTable.workspaceId, workspaceId),
              isNull(auditsTable.workspaceId),
            ),
          ),
        )
        .limit(1);
      if (scopedAudit) return project;
    }
  }

  return null;
}

/** Load one audit with workspace RBAC; members can claim unassigned audits on write. */
export async function loadAuditForRequest(
  req: Request,
  auditId: number,
  mode: AuditAccessMode = "read",
): Promise<typeof auditsTable.$inferSelect | null> {
  const ctx = getWorkspaceCtx(req);
  const userId = (req as AuthedRequest).userId;
  const ownerId = getAccountOwnerId(req);
  const workspaceId = getListScopeWorkspaceId(req);

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(
      and(
        ownerProjectFilter(auditsTable, auditsTable, ownerId, workspaceId),
        eq(auditsTable.isDeleted, 0),
        eq(auditsTable.id, auditId),
      ),
    )
    .limit(1);

  if (!audit) return null;
  if (ctx.isAccountOwner) return audit;

  for (const feature of AUDIT_SCOPE_FEATURES) {
    if (requireWorkspacePerm(ctx, feature, "viewGlobal")) return audit;
  }

  const memberOwnsAudit =
    audit.createdByUserId === userId
    && (audit.workspaceId === workspaceId || audit.workspaceId == null);
  if (memberOwnsAudit) return audit;

  const worked = await loadWorkedProjects(req);
  if (worked && memberHasProjectAccess(worked, "audit", auditId)) {
    return audit;
  }

  if (mode === "write") {
    const canEdit = AUDIT_SCOPE_FEATURES.some((feature) => requireWorkspacePerm(ctx, feature, "edit"));
    if (canEdit && audit.createdByUserId == null) {
      const [claimed] = await db
        .update(auditsTable)
        .set({ createdByUserId: userId, updatedAt: new Date() })
        .where(eq(auditsTable.id, auditId))
        .returning();
      return claimed ?? null;
    }
  }

  return null;
}
