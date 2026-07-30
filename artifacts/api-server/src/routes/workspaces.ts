import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc, count, inArray, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { randomBytes } from "crypto";
import {
  db,
  workspacesTable,
  workspaceRolesTable,
  workspaceMembersTable,
  plansTable,
  subscriptionsTable,
  userProfilesTable,
} from "@workspace/db";
import {
  WORKSPACE_FEATURES,
  WORKSPACE_FEATURE_META,
  WORKSPACE_PRODUCT_FEATURES,
  WORKSPACE_FEATURE_GROUP_ORDER,
} from "@workspace/workspace-permissions";
import {
  listAccessibleWorkspaces,
  resolveWorkspaceContext,
  resolveAccountOwnerId,
  WORKSPACE_HEADER,
  requireWorkspacePerm as checkPerm,
} from "../lib/workspace-context";
import { ensureWorkspacesMigrated } from "../lib/ensure-workspaces";
import { ensureAccountRolesMigrated, listAccountRoles, getAccountRole } from "../lib/ensure-account-roles";
import { deliverWorkspaceMemberInvite } from "../lib/workspace-invite.js";
import { createNotification } from "../lib/notifications.js";
import { upsertUserProfile } from "../lib/user-profile.js";
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
  try {
    const userId = (req as AuthedRequest).userId;
    const list = await listAccessibleWorkspaces(userId);
    res.json({ workspaces: list });
  } catch (err) {
    console.error("[workspaces] list failed", err);
    res.status(500).json({ error: "Failed to load workspaces" });
  }
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

router.get("/workspaces/overview", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  await ensureWorkspacesMigrated();
  await ensureAccountRolesMigrated();
  const accountOwnerId = await resolveAccountOwnerId(userId);
  if (accountOwnerId !== userId) {
    res.status(403).json({ error: "Only the account owner can view workspace overview" });
    return;
  }

  const owned = await db
    .select()
    .from(workspacesTable)
    .where(and(eq(workspacesTable.accountOwnerId, accountOwnerId), eq(workspacesTable.isDeleted, 0)))
    .orderBy(desc(workspacesTable.isDefault), workspacesTable.name);

  const workspaceIds = owned.map((w) => w.id);
  if (workspaceIds.length === 0) {
    res.json({
      totalWorkspaces: 0,
      totalMembers: 0,
      activeMembers: 0,
      pendingInvites: 0,
      totalRoles: 0,
      workspaces: [],
    });
    return;
  }

  const members = await db
    .select({
      workspaceId: workspaceMembersTable.workspaceId,
      status: workspaceMembersTable.status,
    })
    .from(workspaceMembersTable)
    .where(and(
      inArray(workspaceMembersTable.workspaceId, workspaceIds),
      eq(workspaceMembersTable.isDeleted, 0),
    ));

  const roles = await listAccountRoles(accountOwnerId);

  const memberStats = new Map<number, { total: number; active: number; pending: number }>();
  for (const m of members) {
    const stats = memberStats.get(m.workspaceId) ?? { total: 0, active: 0, pending: 0 };
    stats.total += 1;
    if (m.status === "active") stats.active += 1;
    if (m.status === "pending") stats.pending += 1;
    memberStats.set(m.workspaceId, stats);
  }

  let totalMembers = 0;
  let activeMembers = 0;
  let pendingInvites = 0;
  for (const stats of memberStats.values()) {
    totalMembers += stats.total;
    activeMembers += stats.active;
    pendingInvites += stats.pending;
  }

  res.json({
    totalWorkspaces: owned.length,
    totalMembers,
    activeMembers,
    pendingInvites,
    totalRoles: roles.length,
    workspaces: owned.map((w) => {
      const stats = memberStats.get(w.id) ?? { total: 0, active: 0, pending: 0 };
      return {
        id: w.id,
        name: w.name,
        description: w.description,
        clientLabel: w.clientLabel,
        isDefault: w.isDefault,
        memberCount: stats.total,
        activeMemberCount: stats.active,
        pendingMemberCount: stats.pending,
      };
    }),
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

  const isFirstWorkspace = Number(total) === 0;

  const [ws] = await db.insert(workspacesTable).values({
    accountOwnerId,
    name: name.trim(),
    description: description?.trim() || null,
    clientLabel: clientLabel?.trim() || null,
    isDefault: isFirstWorkspace,
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

router.get("/workspaces/:id/summary", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, ctx.workspaceId)).limit(1);
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const [memberStats] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${workspaceMembersTable.status} = 'active')`,
      pending: sql<number>`count(*) filter (where ${workspaceMembersTable.status} = 'pending')`,
    })
    .from(workspaceMembersTable)
    .where(and(
      eq(workspaceMembersTable.workspaceId, ctx.workspaceId),
      eq(workspaceMembersTable.isDeleted, 0),
    ));

  const accountRoles = await listAccountRoles(ctx.accountOwnerId);

  res.json({
    id: ws.id,
    name: ws.name,
    description: ws.description,
    clientLabel: ws.clientLabel,
    isDefault: ws.isDefault,
    createdAt: ws.createdAt,
    roleName: ctx.roleName ?? (ctx.isAccountOwner ? "Owner" : ctx.legacyRole),
    isAccountOwner: ctx.isAccountOwner,
    memberCount: Number(memberStats?.total ?? 0),
    activeMemberCount: Number(memberStats?.active ?? 0),
    pendingMemberCount: Number(memberStats?.pending ?? 0),
    roleCount: accountRoles.length,
  });
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
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const wasDefault = ws.isDefault;

  await db.update(workspacesTable)
    .set({ isDeleted: 1, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(workspacesTable.id, ctx.workspaceId));

  if (wasDefault) {
    const [nextDefault] = await db
      .select()
      .from(workspacesTable)
      .where(and(
        eq(workspacesTable.accountOwnerId, ctx.accountOwnerId),
        eq(workspacesTable.isDeleted, 0),
      ))
      .orderBy(workspacesTable.name)
      .limit(1);

    if (nextDefault) {
      await db.update(workspacesTable)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(workspacesTable.id, nextDefault.id));
    }
  }

  res.sendStatus(204);
});

// ─── Roles (account-global, shared across workspaces) ───────────────────────

router.get("/workspaces/:workspaceId/roles", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const roles = await listAccountRoles(ctx.accountOwnerId);
  res.json({ roles });
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
  const inviterUserId = (req as AuthedRequest).userId;
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

  const normalizedEmail = invitedEmail.trim().toLowerCase();
  const displayName = invitedName?.trim() || normalizedEmail.split("@")[0] || "Member";

  const existingMembers = await db.select()
    .from(workspaceMembersTable)
    .where(and(
      eq(workspaceMembersTable.workspaceId, ctx.workspaceId),
      eq(workspaceMembersTable.invitedEmail, normalizedEmail),
    ));

  const activeMember = existingMembers.find((m) => m.isDeleted === 0 && m.status !== "revoked");
  if (activeMember) {
    res.status(409).json({ error: "This email has already been invited to this workspace." });
    return;
  }

  const token = randomBytes(24).toString("hex");
  const revokedMember = existingMembers.find((m) => m.status === "revoked" || m.isDeleted === 1);

  let member;
  if (revokedMember) {
    const [updated] = await db.update(workspaceMembersTable)
      .set({
        invitedName: displayName,
        roleId: roleId ?? null,
        legacyRole: legacyRole ?? "editor",
        status: "pending",
        inviteToken: token,
        invitedAt: new Date(),
        userId: null,
        acceptedAt: null,
        isDeleted: 0,
        deletedAt: null,
      })
      .where(eq(workspaceMembersTable.id, revokedMember.id))
      .returning();
    member = updated;
  } else {
    const [inserted] = await db.insert(workspaceMembersTable).values({
      workspaceId: ctx.workspaceId,
      invitedEmail: normalizedEmail,
      invitedName: displayName,
      roleId: roleId ?? null,
      legacyRole: legacyRole ?? "editor",
      status: "pending",
      inviteToken: token,
    }).returning();
    member = inserted;
  }

  const [workspace] = await db.select({ name: workspacesTable.name })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, ctx.workspaceId))
    .limit(1);

  let roleName = legacyRole ?? "editor";
  if (roleId) {
    const role = await getAccountRole(ctx.accountOwnerId, Number(roleId));
    if (role?.name) roleName = role.name;
  }

  const [inviterProfile] = await db.select({
    fullName: userProfilesTable.fullName,
    companyName: userProfilesTable.companyName,
  })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, inviterUserId))
    .limit(1);

  const inviterName = inviterProfile?.fullName?.trim()
    || inviterProfile?.companyName?.trim()
    || "A workspace admin";
  const workspaceName = workspace?.name ?? "Workspace";

  const delivery = await deliverWorkspaceMemberInvite({
    invitedEmail: normalizedEmail,
    invitedName: displayName,
    workspaceName,
    roleName,
    inviterName,
    inviteToken: member.inviteToken,
    req,
  });

  res.status(201).json({ ...member, ...delivery });
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

router.post("/workspaces/:workspaceId/members/:memberId/resend", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const inviterUserId = (req as AuthedRequest).userId;
  if (!checkPerm(ctx, "team", "create") && !ctx.isAccountOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const memberId = Number(req.params.memberId);
  const [row] = await db.select({
    member: workspaceMembersTable,
    workspaceName: workspacesTable.name,
    roleName: workspaceRolesTable.name,
  })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .leftJoin(workspaceRolesTable, eq(workspaceMembersTable.roleId, workspaceRolesTable.id))
    .where(and(
      eq(workspaceMembersTable.id, memberId),
      eq(workspaceMembersTable.workspaceId, ctx.workspaceId),
      eq(workspaceMembersTable.isDeleted, 0),
    ))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (row.member.status !== "pending") {
    res.status(400).json({ error: "Only pending invites can be resent" });
    return;
  }

  const [inviterProfile] = await db.select({
    fullName: userProfilesTable.fullName,
    companyName: userProfilesTable.companyName,
  })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, inviterUserId))
    .limit(1);

  const inviterName = inviterProfile?.fullName?.trim()
    || inviterProfile?.companyName?.trim()
    || "A workspace admin";
  const roleName = row.roleName ?? row.member.legacyRole ?? "member";

  const delivery = await deliverWorkspaceMemberInvite({
    invitedEmail: row.member.invitedEmail,
    invitedName: row.member.invitedName,
    workspaceName: row.workspaceName,
    roleName,
    inviterName,
    inviteToken: row.member.inviteToken,
    req,
  });

  res.json({ ...row.member, ...delivery });
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

// ─── Workspace invite accept (public + auth) ─────────────────────────────────

router.get("/workspace-invite/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const [row] = await db.select({
    member: workspaceMembersTable,
    workspaceName: workspacesTable.name,
    roleName: workspaceRolesTable.name,
  })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .leftJoin(workspaceRolesTable, eq(workspaceMembersTable.roleId, workspaceRolesTable.id))
    .where(and(
      eq(workspaceMembersTable.inviteToken, token),
      eq(workspaceMembersTable.isDeleted, 0),
    ))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Invite not found or expired" });
    return;
  }
  if (row.member.status === "revoked") {
    res.status(410).json({ error: "This invite has been revoked" });
    return;
  }
  if (row.member.status === "active") {
    res.status(409).json({ error: "This invite has already been accepted" });
    return;
  }

  res.json({
    id: row.member.id,
    invitedEmail: row.member.invitedEmail,
    invitedName: row.member.invitedName,
    status: row.member.status,
    invitedAt: row.member.invitedAt,
    workspaceId: row.member.workspaceId,
    workspaceName: row.workspaceName,
    roleName: row.roleName ?? row.member.legacyRole ?? "member",
  });
});

router.post("/workspace-invite/:token/accept", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const token = String(req.params.token ?? "");
  const auth = getAuth(req);
  const sessionEmail = auth?.sessionClaims?.email as string | undefined;

  const [row] = await db.select({
    member: workspaceMembersTable,
    workspaceName: workspacesTable.name,
    accountOwnerId: workspacesTable.accountOwnerId,
    roleName: workspaceRolesTable.name,
  })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .leftJoin(workspaceRolesTable, eq(workspaceMembersTable.roleId, workspaceRolesTable.id))
    .where(eq(workspaceMembersTable.inviteToken, token))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  const invite = row.member;
  if (invite.status === "revoked" || invite.isDeleted === 1) {
    res.status(410).json({ error: "This invite has been revoked" });
    return;
  }
  if (invite.status === "active") {
    res.status(409).json({ error: "Already accepted" });
    return;
  }

  if (sessionEmail && sessionEmail.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
    res.status(403).json({
      error: `This invite was sent to ${invite.invitedEmail}. Sign in with that email to accept.`,
    });
    return;
  }

  const existingActive = await db.select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(and(
      eq(workspaceMembersTable.workspaceId, invite.workspaceId),
      eq(workspaceMembersTable.userId, userId),
      eq(workspaceMembersTable.status, "active"),
      eq(workspaceMembersTable.isDeleted, 0),
    ))
    .limit(1);

  if (existingActive.length > 0) {
    res.status(409).json({ error: "You are already a member of this workspace" });
    return;
  }

  await db.update(workspaceMembersTable)
    .set({
      status: "active",
      userId,
      acceptedAt: new Date(),
      isDeleted: 0,
      deletedAt: null,
    })
    .where(eq(workspaceMembersTable.inviteToken, token));

  await upsertUserProfile(userId, { onboardingCompleted: true });

  const roleName = row.roleName ?? invite.legacyRole ?? "member";
  void createNotification({
    userId: row.accountOwnerId,
    type: "team_invite_accepted",
    title: "Workspace member joined",
    message: `${invite.invitedName?.trim() || invite.invitedEmail} joined ${row.workspaceName} (${roleName}).`,
    link: `/workspaces/${invite.workspaceId}/members`,
  });

  res.json({
    ok: true,
    workspaceId: invite.workspaceId,
    workspaceName: row.workspaceName,
    roleName,
  });
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
