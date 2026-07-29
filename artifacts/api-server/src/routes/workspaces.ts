import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { randomBytes } from "crypto";
import {
  db,
  workspacesTable,
  workspaceRolesTable,
  workspaceMembersTable,
  plansTable,
  subscriptionsTable,
} from "@workspace/db";
import {
  WORKSPACE_FEATURES,
  WORKSPACE_FEATURE_META,
  WORKSPACE_PRODUCT_FEATURES,
  WORKSPACE_FEATURE_GROUP_ORDER,
  mergePermissionsFromForm,
  legacyRolePermissions,
} from "@workspace/workspace-permissions";
import {
  listAccessibleWorkspaces,
  resolveWorkspaceContext,
  resolveAccountOwnerId,
  WORKSPACE_HEADER,
  requireWorkspacePerm as checkPerm,
} from "../lib/workspace-context";
import { ensureWorkspacesMigrated } from "../lib/ensure-workspaces";
import type { WorkspaceAuthedRequest } from "../middlewares/workspace-auth";

const router: IRouter = Router();
const MAX_WORKSPACES_PER_ACCOUNT = 50;

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as AuthedRequest).userId = userId;
  next();
}

async function requireWorkspaceAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  const workspaceId = Number(req.params.workspaceId ?? req.params.id);
  if (!workspaceId || Number.isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspace id" });
    return;
  }
  const ctx = await resolveWorkspaceContext(userId, workspaceId);
  if (!ctx) {
    res.status(403).json({ error: "Workspace not found or access denied" });
    return;
  }
  (req as WorkspaceAuthedRequest).workspace = ctx;
  next();
}

// ─── List workspaces accessible to current user ─────────────────────────────

router.get("/workspaces", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const list = await listAccessibleWorkspaces(userId);
  res.json({ workspaces: list });
});

router.get("/workspaces/features", requireAuth, async (_req, res): Promise<void> => {
  res.json({
    features: WORKSPACE_FEATURES,
    productFeatures: WORKSPACE_PRODUCT_FEATURES,
    meta: WORKSPACE_FEATURE_META,
    groupOrder: WORKSPACE_FEATURE_GROUP_ORDER,
    actions: ["viewGlobal", "viewOwn", "create", "edit", "delete"],
  });
});

// ─── Create workspace (account owner only) ───────────────────────────────────

router.post("/workspaces", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  await ensureWorkspacesMigrated();
  const accountOwnerId = await resolveAccountOwnerId(userId);
  if (accountOwnerId !== userId) {
    res.status(403).json({ error: "Only the account owner can create workspaces" });
    return;
  }

  const { name, description, clientLabel, preserveLegacyPermissions } = req.body as {
    name?: string;
    description?: string;
    clientLabel?: string;
    preserveLegacyPermissions?: boolean;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "Workspace name is required" });
    return;
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(workspacesTable)
    .where(and(eq(workspacesTable.accountOwnerId, accountOwnerId), eq(workspacesTable.isDeleted, 0)));

  if (Number(total) >= MAX_WORKSPACES_PER_ACCOUNT) {
    res.status(400).json({ error: `Maximum of ${MAX_WORKSPACES_PER_ACCOUNT} workspaces per account` });
    return;
  }

  const [ws] = await db.insert(workspacesTable).values({
    accountOwnerId,
    name: name.trim(),
    description: description?.trim() || null,
    clientLabel: clientLabel?.trim() || null,
    isDefault: false,
    preserveLegacyPermissions: preserveLegacyPermissions ?? true,
  }).returning();

  res.status(201).json(ws);
});

// ─── Get / update / delete workspace ─────────────────────────────────────────

router.get("/workspaces/:id", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, ctx.workspaceId)).limit(1);
  res.json({ ...ws, roleName: ctx.roleName ?? (ctx.isAccountOwner ? "Owner" : ctx.legacyRole) });
});

router.patch("/workspaces/:id", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  if (!checkPerm(ctx, "workspaces", "edit") && !ctx.isAccountOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name, description, clientLabel, preserveLegacyPermissions } = req.body as {
    name?: string;
    description?: string;
    clientLabel?: string;
    preserveLegacyPermissions?: boolean;
  };

  const [updated] = await db.update(workspacesTable)
    .set({
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(clientLabel !== undefined && { clientLabel: clientLabel?.trim() || null }),
      ...(preserveLegacyPermissions !== undefined && { preserveLegacyPermissions }),
      updatedAt: new Date(),
    })
    .where(eq(workspacesTable.id, ctx.workspaceId))
    .returning();

  res.json(updated);
});

router.delete("/workspaces/:id", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  if (!ctx.isAccountOwner) {
    res.status(403).json({ error: "Only the account owner can delete workspaces" });
    return;
  }

  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, ctx.workspaceId)).limit(1);
  if (ws?.isDefault) {
    res.status(400).json({ error: "Cannot delete the default workspace" });
    return;
  }

  await db.update(workspacesTable)
    .set({ isDeleted: 1, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(workspacesTable.id, ctx.workspaceId));

  res.sendStatus(204);
});

// ─── Roles CRUD (per workspace) ────────────────────────────────────────────────

router.get("/workspaces/:workspaceId/roles", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const roles = await db
    .select()
    .from(workspaceRolesTable)
    .where(and(
      eq(workspaceRolesTable.workspaceId, ctx.workspaceId),
      eq(workspaceRolesTable.isSystem, false),
    ))
    .orderBy(workspaceRolesTable.name);
  res.json({ roles });
});

router.post("/workspaces/:workspaceId/roles", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  if (!checkPerm(ctx, "team", "create") && !ctx.isAccountOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name, description, permissions, preserveExisting } = req.body as {
    name?: string;
    description?: string;
    permissions?: Record<string, Record<string, boolean>>;
    preserveExisting?: boolean;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "Role name is required" });
    return;
  }

  const perms = preserveExisting
    ? legacyRolePermissions("editor")
    : mergePermissionsFromForm(permissions ?? {});

  const [role] = await db.insert(workspaceRolesTable).values({
    workspaceId: ctx.workspaceId,
    name: name.trim(),
    description: description?.trim() || null,
    permissions: perms,
    isSystem: false,
  }).returning();

  res.status(201).json(role);
});

router.patch("/workspaces/:workspaceId/roles/:roleId", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  if (!checkPerm(ctx, "team", "edit") && !ctx.isAccountOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const roleId = Number(req.params.roleId);
  const { name, description, permissions } = req.body as {
    name?: string;
    description?: string;
    permissions?: Record<string, Record<string, boolean>>;
  };

  const [existing] = await db
    .select()
    .from(workspaceRolesTable)
    .where(and(eq(workspaceRolesTable.id, roleId), eq(workspaceRolesTable.workspaceId, ctx.workspaceId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const [updated] = await db.update(workspaceRolesTable)
    .set({
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(permissions !== undefined && { permissions: mergePermissionsFromForm(permissions) }),
      updatedAt: new Date(),
    })
    .where(eq(workspaceRolesTable.id, roleId))
    .returning();

  res.json(updated);
});

router.delete("/workspaces/:workspaceId/roles/:roleId", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  if (!checkPerm(ctx, "team", "delete") && !ctx.isAccountOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const roleId = Number(req.params.roleId);
  const [existing] = await db
    .select()
    .from(workspaceRolesTable)
    .where(and(eq(workspaceRolesTable.id, roleId), eq(workspaceRolesTable.workspaceId, ctx.workspaceId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  await db.update(workspaceMembersTable)
    .set({ roleId: null })
    .where(eq(workspaceMembersTable.roleId, roleId));

  await db.delete(workspaceRolesTable).where(eq(workspaceRolesTable.id, roleId));
  res.sendStatus(204);
});

// ─── Members (per workspace) ─────────────────────────────────────────────────

router.get("/workspaces/:workspaceId/members", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const members = await db
    .select({
      member: workspaceMembersTable,
      roleName: workspaceRolesTable.name,
    })
    .from(workspaceMembersTable)
    .leftJoin(workspaceRolesTable, eq(workspaceMembersTable.roleId, workspaceRolesTable.id))
    .where(and(
      eq(workspaceMembersTable.workspaceId, ctx.workspaceId),
      eq(workspaceMembersTable.isDeleted, 0),
    ))
    .orderBy(desc(workspaceMembersTable.invitedAt));

  res.json({
    members: members.map((m) => ({
      ...m.member,
      roleName: m.roleName ?? m.member.legacyRole,
    })),
  });
});

router.post("/workspaces/:workspaceId/members", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  if (!checkPerm(ctx, "team", "create") && !ctx.isAccountOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { invitedEmail, invitedName, roleId, legacyRole } = req.body as {
    invitedEmail?: string;
    invitedName?: string;
    roleId?: number;
    legacyRole?: string;
  };

  if (!invitedEmail?.trim()) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const token = randomBytes(24).toString("hex");
  const [member] = await db.insert(workspaceMembersTable).values({
    workspaceId: ctx.workspaceId,
    invitedEmail: invitedEmail.trim().toLowerCase(),
    invitedName: invitedName?.trim() || invitedEmail.split("@")[0] || "Member",
    roleId: roleId ?? null,
    legacyRole: legacyRole ?? "editor",
    status: "pending",
    inviteToken: token,
  }).returning();

  res.status(201).json(member);
});

router.patch("/workspaces/:workspaceId/members/:memberId", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  if (!checkPerm(ctx, "team", "edit") && !ctx.isAccountOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const memberId = Number(req.params.memberId);
  const { roleId, legacyRole, status } = req.body as { roleId?: number; legacyRole?: string; status?: string };

  const [updated] = await db.update(workspaceMembersTable)
    .set({
      ...(roleId !== undefined && { roleId }),
      ...(legacyRole !== undefined && { legacyRole }),
      ...(status !== undefined && { status }),
    })
    .where(and(
      eq(workspaceMembersTable.id, memberId),
      eq(workspaceMembersTable.workspaceId, ctx.workspaceId),
    ))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(updated);
});

router.delete("/workspaces/:workspaceId/members/:memberId", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  if (!checkPerm(ctx, "team", "delete") && !ctx.isAccountOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const memberId = Number(req.params.memberId);
  await db.update(workspaceMembersTable)
    .set({ isDeleted: 1, deletedAt: new Date(), status: "revoked" })
    .where(and(
      eq(workspaceMembersTable.id, memberId),
      eq(workspaceMembersTable.workspaceId, ctx.workspaceId),
    ));

  res.sendStatus(204);
});

// ─── Current user permissions in workspace ───────────────────────────────────

router.get("/workspaces/:workspaceId/permissions/me", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  res.json({
    workspaceId: ctx.workspaceId,
    permissions: ctx.permissions,
    roleName: ctx.roleName ?? (ctx.isAccountOwner ? "Owner" : ctx.legacyRole),
    isAccountOwner: ctx.isAccountOwner,
    preserveLegacyPermissions: ctx.preserveLegacyPermissions,
    header: WORKSPACE_HEADER,
  });
});

export default router;
