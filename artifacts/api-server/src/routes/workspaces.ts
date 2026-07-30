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
  creditsTable,
  teamMembersTable,
  memberCreditsTable,
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
import { ensureWorkspaceCreditsMigrated } from "../lib/ensure-workspace-credits.js";
import { displayWorkspaceRoleLabel } from "../lib/role-display.js";
import {
  getWorkspaceCredits,
  setWorkspaceCreditPool,
  setWorkspaceMemberCredits,
  sumAllocatedMemberCreditsForWorkspace,
  getWorkspaceMemberCredits,
  sumWorkspacePoolsForOwner,
} from "../lib/workspace-credits.js";
import { deliverWorkspaceMemberInvite } from "../lib/workspace-invite.js";
import { getWorkspaceMemberSummaryForOwner } from "../lib/workspace-member-summary.js";
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
  await ensureWorkspaceCreditsMigrated();
  const accountOwnerId = await resolveAccountOwnerId(userId);
  if (accountOwnerId !== userId) {
    res.status(403).json({ error: "Only the account owner can view workspace overview" });
    return;
  }

  const [ownerCreditsRow] = await db.select().from(creditsTable).where(eq(creditsTable.userId, accountOwnerId));
  const ownerCredits = ownerCreditsRow ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const inWorkspacePools = await sumWorkspacePoolsForOwner(accountOwnerId);
  const availableToFundWorkspaces = {
    aiCredits: Math.max(0, ownerCredits.aiCredits - inWorkspacePools.aiCredits),
    imageCredits: Math.max(0, ownerCredits.imageCredits - inWorkspacePools.imageCredits),
    auditCredits: Math.max(0, ownerCredits.auditCredits - inWorkspacePools.auditCredits),
  };

  const owned = await db
    .select()
    .from(workspacesTable)
    .where(and(eq(workspacesTable.accountOwnerId, accountOwnerId), eq(workspacesTable.isDeleted, 0)))
    .orderBy(desc(workspacesTable.isDefault), workspacesTable.name);

  const roles = await listAccountRoles(accountOwnerId);
  const summary = await getWorkspaceMemberSummaryForOwner(accountOwnerId, { includeMembers: true });
  const ownedById = new Map(owned.map((w) => [w.id, w]));

  const workspacesWithPools = await Promise.all(summary.workspaces.map(async (w) => {
    const meta = ownedById.get(w.id);
    const pool = await getWorkspaceCredits(w.id);
    const memberAllocated = await sumAllocatedMemberCreditsForWorkspace(w.id);
    return {
      id: w.id,
      name: w.name,
      description: meta?.description ?? null,
      clientLabel: meta?.clientLabel ?? null,
      isDefault: w.isDefault,
      memberCount: w.memberCount,
      activeMemberCount: w.activeMemberCount,
      pendingMemberCount: w.pendingMemberCount,
      members: w.members,
      poolCredits: pool,
      memberAllocatedCredits: memberAllocated,
      poolAvailableForMembers: {
        aiCredits: Math.max(0, pool.aiCredits - memberAllocated.aiCredits),
        imageCredits: Math.max(0, pool.imageCredits - memberAllocated.imageCredits),
        auditCredits: Math.max(0, pool.auditCredits - memberAllocated.auditCredits),
      },
    };
  }));

  res.json({
    totalWorkspaces: owned.length,
    totalMembers: summary.totalMemberships,
    uniquePeople: summary.uniquePeople,
    activeMembers: summary.activeMembers,
    pendingInvites: summary.pendingInvites,
    totalRoles: roles.length,
    ownerCredits: {
      aiCredits: ownerCredits.aiCredits,
      imageCredits: ownerCredits.imageCredits,
      auditCredits: ownerCredits.auditCredits,
    },
    inWorkspacePools,
    availableToFundWorkspaces,
    workspaces: workspacesWithPools,
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

// ─── Workspace credit pool (account owner → workspace) — register before /workspaces/:id ─

router.patch("/workspaces/:id/credits", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  await ensureWorkspaceCreditsMigrated();
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const userId = (req as AuthedRequest).userId;
  if (!ctx.isAccountOwner || userId !== ctx.accountOwnerId) {
    res.status(403).json({ error: "Only the account owner can fund workspace credit pools" });
    return;
  }

  const { aiCredits, imageCredits, auditCredits } = req.body as {
    aiCredits?: number;
    imageCredits?: number;
    auditCredits?: number;
  };

  try {
    const result = await setWorkspaceCreditPool(
      ctx.accountOwnerId,
      ctx.workspaceId,
      aiCredits ?? 0,
      imageCredits ?? 0,
      auditCredits ?? 0,
    );
    const inPools = await sumWorkspacePoolsForOwner(ctx.accountOwnerId);
    res.json({
      workspaceCredits: result.workspaceCredits,
      accountCredits: result.accountCredits,
      inWorkspacePools: inPools,
      availableToFundWorkspaces: {
        aiCredits: Math.max(0, result.accountCredits.aiCredits),
        imageCredits: Math.max(0, result.accountCredits.imageCredits),
        auditCredits: Math.max(0, result.accountCredits.auditCredits),
      },
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === "INSUFFICIENT_ACCOUNT" || e.code === "BELOW_MEMBER_ALLOCATIONS") {
      res.status(400).json({ error: e.message, code: e.code });
      return;
    }
    console.error("[workspaces] pool update failed", err);
    res.status(500).json({ error: "Failed to update workspace credit pool" });
  }
});

router.get("/workspaces/:id", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, ctx.workspaceId)).limit(1);
  res.json({ ...ws, roleName: displayWorkspaceRoleLabel({ isAccountOwner: ctx.isAccountOwner, roleId: ctx.roleId, roleName: ctx.roleName }) });
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
    roleName: displayWorkspaceRoleLabel({ isAccountOwner: ctx.isAccountOwner, roleId: ctx.roleId, roleName: ctx.roleName }),
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
  await ensureWorkspaceCreditsMigrated();
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

  const canViewCredits = ctx.isAccountOwner || checkPerm(ctx, "credits", "viewGlobal");
  const pool = canViewCredits ? await getWorkspaceCredits(ctx.workspaceId) : null;
  const memberAllocated = canViewCredits
    ? await sumAllocatedMemberCreditsForWorkspace(ctx.workspaceId)
    : null;

  const memberIds = members.map((m) => m.member.id);
  const creditRows = memberIds.length > 0
    ? await db.select().from(memberCreditsTable).where(inArray(memberCreditsTable.workspaceMemberId, memberIds))
    : [];
  const creditsByMember = new Map(creditRows.map((c) => [c.workspaceMemberId, c]));

  res.json({
    poolCredits: pool,
    memberAllocatedCredits: memberAllocated,
    poolAvailableForMembers: pool && memberAllocated
      ? {
          aiCredits: Math.max(0, pool.aiCredits - memberAllocated.aiCredits),
          imageCredits: Math.max(0, pool.imageCredits - memberAllocated.imageCredits),
          auditCredits: Math.max(0, pool.auditCredits - memberAllocated.auditCredits),
        }
      : null,
    members: members.map((m) => {
      const allocated = creditsByMember.get(m.member.id);
      return {
        ...m.member,
        roleName: m.roleName ?? null,
        allocatedCredits: canViewCredits && allocated
          ? { aiCredits: allocated.aiCredits, imageCredits: allocated.imageCredits, auditCredits: allocated.auditCredits }
          : undefined,
      };
    }),
  });
});

router.patch("/workspaces/:workspaceId/members/:memberId/credits", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  await ensureWorkspaceCreditsMigrated();
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const memberId = Number(req.params.memberId);
  if (!memberId || Number.isNaN(memberId)) {
    res.status(400).json({ error: "Invalid member id" });
    return;
  }

  const canAllocate = !ctx.isAccountOwner && checkPerm(ctx, "credits", "edit");
  if (!canAllocate) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [wm] = await db
    .select()
    .from(workspaceMembersTable)
    .where(and(
      eq(workspaceMembersTable.id, memberId),
      eq(workspaceMembersTable.workspaceId, ctx.workspaceId),
      eq(workspaceMembersTable.isDeleted, 0),
    ));
  if (!wm) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const { aiCredits, imageCredits, auditCredits } = req.body as {
    aiCredits?: number;
    imageCredits?: number;
    auditCredits?: number;
  };

  let teamMemberId: number | null = null;
  if (wm.userId) {
    const [tm] = await db
      .select({ id: teamMembersTable.id })
      .from(teamMembersTable)
      .where(and(
        eq(teamMembersTable.ownerUserId, ctx.accountOwnerId),
        eq(teamMembersTable.memberUserId, wm.userId),
        eq(teamMembersTable.status, "active"),
      ))
      .limit(1);
    teamMemberId = tm?.id ?? null;
  }

  try {
    const credits = await setWorkspaceMemberCredits(
      ctx.workspaceId,
      memberId,
      teamMemberId,
      aiCredits ?? 0,
      imageCredits ?? 0,
      auditCredits ?? 0,
    );
    const pool = await getWorkspaceCredits(ctx.workspaceId);
    const memberAllocated = await sumAllocatedMemberCreditsForWorkspace(ctx.workspaceId);
    res.json({
      workspaceMemberId: memberId,
      credits,
      poolCredits: pool,
      memberAllocatedCredits: memberAllocated,
      poolAvailableForMembers: {
        aiCredits: Math.max(0, pool.aiCredits - memberAllocated.aiCredits),
        imageCredits: Math.max(0, pool.imageCredits - memberAllocated.imageCredits),
        auditCredits: Math.max(0, pool.auditCredits - memberAllocated.auditCredits),
      },
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === "EXCEEDS_WORKSPACE_POOL") {
      res.status(400).json({ error: e.message, code: e.code });
      return;
    }
    console.error("[workspaces] member credits failed", err);
    res.status(500).json({ error: "Failed to update member credits" });
  }
});

router.post("/workspaces/:workspaceId/members", requireAuth, requireWorkspaceAccess, async (req, res): Promise<void> => {
  const ctx = (req as WorkspaceAuthedRequest).workspace;
  const inviterUserId = (req as AuthedRequest).userId;
  if (!checkPerm(ctx, "team", "create") && !ctx.isAccountOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { invitedEmail, invitedName, roleId } = req.body as {
    invitedEmail?: string;
    invitedName?: string;
    roleId?: number;
  };

  if (!invitedEmail?.trim()) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  if (roleId == null || Number.isNaN(Number(roleId))) {
    res.status(400).json({ error: "Role is required. Select a role from Roles settings." });
    return;
  }

  const accountRole = await getAccountRole(ctx.accountOwnerId, Number(roleId));
  if (!accountRole) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const resolvedLegacyRole = accountRole.legacyRoleKey ?? "editor";

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
        roleId: accountRole.id,
        legacyRole: resolvedLegacyRole,
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
      roleId: accountRole.id,
      legacyRole: resolvedLegacyRole,
      status: "pending",
      inviteToken: token,
    }).returning();
    member = inserted;
  }

  const [workspace] = await db.select({ name: workspacesTable.name })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, ctx.workspaceId))
    .limit(1);

  const roleName = accountRole.name;

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
  const { roleId, status } = req.body as { roleId?: number; status?: string };

  const updates: Partial<typeof workspaceMembersTable.$inferInsert> = {};
  if (status !== undefined) updates.status = status;
  if (roleId !== undefined) {
    if (roleId == null || Number.isNaN(Number(roleId))) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    const accountRole = await getAccountRole(ctx.accountOwnerId, Number(roleId));
    if (!accountRole) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    updates.roleId = accountRole.id;
    updates.legacyRole = accountRole.legacyRoleKey ?? "editor";
  }

  const [updated] = await db.update(workspaceMembersTable)
    .set(updates)
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
  const roleName = row.roleName ?? "Unassigned";

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
    roleName: displayWorkspaceRoleLabel({ roleId: row.member.roleId, roleName: row.roleName }),
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

  const roleName = row.roleName ?? "Unassigned";
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
    roleName: displayWorkspaceRoleLabel({ isAccountOwner: ctx.isAccountOwner, roleId: ctx.roleId, roleName: ctx.roleName }),
    isAccountOwner: ctx.isAccountOwner,
    preserveLegacyPermissions: ctx.preserveLegacyPermissions,
    header: WORKSPACE_HEADER,
  });
});

export default router;
