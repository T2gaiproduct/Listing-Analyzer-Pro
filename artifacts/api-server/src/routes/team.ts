import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { randomBytes } from "crypto";
import {
  db, teamMembersTable, subscriptionsTable, plansTable,
  creditsTable, userProfilesTable, memberCreditsTable,
} from "@workspace/db";
import { sendEmail } from "../lib/email.js";
import { inviteEmailTemplate, welcomeEmailTemplate } from "../lib/email-templates.js";
import { fetchClerkUserIdByEmail } from "../lib/clerk-user.js";
import { createNotification } from "../lib/notifications.js";
import {
  shouldSendTeamInviteEmailToAddress,
  shouldSendTeamWelcomeEmailToUser,
} from "../lib/notification-preferences.js";
import { getMemberCredits } from "../lib/credits.js";
import { upsertUserProfile } from "../lib/user-profile.js";
import {
  countAuditActivity,
  getLastActivityAt,
  sumAllocatedCreditsForOwner,
  sumCreditsUsedInPeriod,
} from "../lib/team-stats.js";
import { ensureTeamMembersRoleId, getAccountRole } from "../lib/ensure-account-roles.js";
import { ensureWorkspaceCreditsMigrated } from "../lib/ensure-workspace-credits.js";
import { syncTeamMemberWorkspaceMemberships } from "../lib/team-workspace-sync.js";
import { getDefaultWorkspaceId } from "../lib/ensure-workspaces.js";
import { getWorkspaceMemberSummaryForOwner } from "../lib/workspace-member-summary.js";
import { buildWorkspaceMemberStats } from "../lib/workspace-member-stats.js";

const router: IRouter = Router();

async function resolveInviteRole(
  ownerUserId: string,
  body: { roleId?: number; role?: string },
): Promise<{ roleId: number; roleName: string; legacyRole: string } | { error: string }> {
  if (body.roleId == null || Number.isNaN(Number(body.roleId))) {
    return { error: "Role is required. Choose a role from Roles settings." };
  }
  const accountRole = await getAccountRole(ownerUserId, Number(body.roleId));
  if (!accountRole) return { error: "Invalid role" };
  return {
    roleId: accountRole.id,
    roleName: accountRole.name,
    legacyRole: accountRole.legacyRoleKey ?? "editor",
  };
}

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

// ─── List my team members (as workspace owner) ───────────────────────────────
router.get("/team", requireAuth, async (req, res): Promise<void> => {
  await ensureTeamMembersRoleId();
  await ensureWorkspaceCreditsMigrated();
  const userId = (req as AuthedRequest).userId;

  const [sub] = await db.select({
    teamMembers: plansTable.teamMembers,
    planName: plansTable.name,
    status: subscriptionsTable.status,
    currentPeriodStart: subscriptionsTable.currentPeriodStart,
    currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
  }).from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));

  const maxSeats = sub?.teamMembers ?? 1;
  const periodStart = sub?.currentPeriodStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd = sub?.currentPeriodEnd ?? new Date();

  const [ownerCreditsRow] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  const ownerCredits = ownerCreditsRow ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const totalAllocated = await sumAllocatedCreditsForOwner(userId);
  const availableToAllocate = {
    aiCredits: Math.max(0, ownerCredits.aiCredits - totalAllocated.aiCredits),
    imageCredits: Math.max(0, ownerCredits.imageCredits - totalAllocated.imageCredits),
    auditCredits: Math.max(0, ownerCredits.auditCredits - totalAllocated.auditCredits),
  };

  const members = await db.select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, userId), eq(teamMembersTable.status, "active")))
    .orderBy(desc(teamMembersTable.invitedAt));

  const pending = await db.select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, userId), eq(teamMembersTable.status, "pending")))
    .orderBy(desc(teamMembersTable.invitedAt));

  const ownerUsedInPeriod = await sumCreditsUsedInPeriod(userId, periodStart, periodEnd);

  const workspaceIdParam = req.query.workspaceId;
  const scopedWorkspaceId =
    workspaceIdParam != null && String(workspaceIdParam).trim() !== ""
      ? Number(workspaceIdParam)
      : null;
  if (scopedWorkspaceId != null && (!Number.isFinite(scopedWorkspaceId) || scopedWorkspaceId <= 0)) {
    res.status(400).json({ error: "Invalid workspaceId" });
    return;
  }

  const workspaceMembers = await getWorkspaceMemberSummaryForOwner(userId, {
    workspaceId: scopedWorkspaceId ?? undefined,
    includeMembers: true,
  });

  if (scopedWorkspaceId != null && workspaceMembers.workspaces.length === 0) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const memberStats = await Promise.all(members.map(async (m) => {
    if (!m.memberUserId) {
      return {
        memberId: m.id,
        auditCount: 0,
        lastActivityAt: null,
        creditsUsed: 0,
        remainingCredits: null,
        allocatedCredits: null,
      };
    }

    const [allocated] = await db.select().from(memberCreditsTable).where(eq(memberCreditsTable.memberId, m.id));
    const creditsUsed = await sumCreditsUsedInPeriod(m.memberUserId, periodStart, periodEnd);
    const auditCount = await countAuditActivity(m.memberUserId, periodStart, periodEnd);
    const lastActivityAt = await getLastActivityAt(m.memberUserId);

    return {
      memberId: m.id,
      auditCount,
      lastActivityAt,
      creditsUsed,
      remainingCredits: allocated
        ? { aiCredits: allocated.aiCredits, imageCredits: allocated.imageCredits, auditCredits: allocated.auditCredits }
        : { aiCredits: 0, imageCredits: 0, auditCredits: 0 },
      allocatedCredits: allocated
        ? { aiCredits: allocated.aiCredits, imageCredits: allocated.imageCredits, auditCredits: allocated.auditCredits }
        : null,
    };
  }));

  const scopedMembers = scopedWorkspaceId != null
    ? workspaceMembers.workspaces[0]?.members ?? []
    : [];
  const workspaceMemberStats = scopedMembers.length > 0
    ? await buildWorkspaceMemberStats(userId, scopedMembers, periodStart, periodEnd)
    : [];

  res.json({
    maxSeats,
    planName: sub?.planName ?? null,
    planStatus: sub?.status ?? null,
    ownerCredits: {
      aiCredits: ownerCredits.aiCredits,
      imageCredits: ownerCredits.imageCredits,
      auditCredits: ownerCredits.auditCredits,
    },
    totalAllocated,
    availableToAllocate,
    ownerUsedInPeriod,
    members: [...members, ...pending],
    memberStats,
    workspaceMembers,
    workspaceMemberStats,
  });
});

// ─── Send invite ──────────────────────────────────────────────────────────────
router.post("/team/invite", requireAuth, async (req, res): Promise<void> => {
  await ensureTeamMembersRoleId();
  const userId = (req as AuthedRequest).userId;
  const { invitedEmail, invitedName, role, roleId } = req.body as {
    invitedEmail: string;
    invitedName: string;
    role?: string;
    roleId?: number;
  };

  if (!invitedEmail || !invitedName) { res.status(400).json({ error: "Email and name are required" }); return; }

  const resolved = await resolveInviteRole(userId, { roleId, role });
  if ("error" in resolved) { res.status(400).json({ error: resolved.error }); return; }
  const { roleId: resolvedRoleId, roleName, legacyRole } = resolved;

  // Check seat limit
  const [sub] = await db.select({ teamMembers: plansTable.teamMembers })
    .from(subscriptionsTable).leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));
  const maxSeats = sub?.teamMembers ?? 1;

  const existing = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, userId)));
  const activeOrPending = existing.filter((m) => m.status !== "revoked");

  if (activeOrPending.length >= maxSeats - 1) {
    res.status(403).json({ error: `Seat limit reached (${maxSeats} seats). Upgrade your plan to invite more members.` });
    return;
  }

  // Check if already invited (not revoked)
  const alreadyInvited = existing.find((m) => m.invitedEmail.toLowerCase() === invitedEmail.toLowerCase() && m.status !== "revoked");
  if (alreadyInvited) { res.status(409).json({ error: "This email has already been invited." }); return; }

  const token = randomBytes(32).toString("hex");

  // Check if previously revoked — reuse the row to preserve history
  const revokedRecord = existing.find((m) => m.invitedEmail.toLowerCase() === invitedEmail.toLowerCase() && m.status === "revoked");
  let invite;
  if (revokedRecord) {
    const [updated] = await db.update(teamMembersTable)
      .set({
        status: "pending",
        inviteToken: token,
        invitedAt: new Date(),
        role: roleName,
        roleId: resolvedRoleId,
        invitedName,
        memberUserId: null,
        acceptedAt: null,
      })
      .where(eq(teamMembersTable.id, revokedRecord.id))
      .returning();
    invite = updated;
  } else {
    const [inserted] = await db.insert(teamMembersTable).values({
      ownerUserId: userId,
      invitedEmail: invitedEmail.toLowerCase(),
      invitedName,
      role: roleName,
      roleId: resolvedRoleId,
      status: "pending",
      inviteToken: token,
    }).returning();
    invite = inserted;
  }

  // Send invitation email (respect invitee notification preferences for existing accounts)
  try {
    const shouldEmail = await shouldSendTeamInviteEmailToAddress(invitedEmail);

    if (shouldEmail) {
      const [profile] = await db.select({ companyName: userProfilesTable.companyName }).from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
      const inviterName = profile?.companyName ?? "Your team owner";
      const companyName = profile?.companyName ?? "SellerLens";
      const inviteUrl = `${process.env.APP_URL ?? "https://listingauditor.com"}/accept-invite?token=${token}`;
      const html = inviteEmailTemplate({ inviterName, companyName, inviteUrl, role: roleName, invitedName });
      await sendEmail({ to: invitedEmail, subject: `You have been invited to join ${companyName}`, html });
    }
  } catch (emailErr) {
    req.log?.warn?.({ emailErr }, "Failed to send invite email");
  }

  try {
    const inviteeUserId = await fetchClerkUserIdByEmail(invitedEmail);
    if (inviteeUserId) {
      const [profile] = await db
        .select({ companyName: userProfilesTable.companyName })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, userId));
      const inviterName = profile?.companyName ?? "Your team owner";
      void createNotification({
        userId: inviteeUserId,
        type: "team_invite",
        title: "Team invitation",
        message: `${inviterName} invited you to join as ${roleName}.`,
        link: `/accept-invite?token=${token}`,
      });
    }
  } catch (notifyErr) {
    req.log?.warn?.({ notifyErr }, "Failed to send team invite notification");
  }

  res.status(201).json({ invite, token });
});

// ─── Change member role ───────────────────────────────────────────────────────
router.patch("/team/:id/role", requireAuth, async (req, res): Promise<void> => {
  await ensureTeamMembersRoleId();
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { role, roleId } = req.body as { role?: string; roleId?: number };

  const resolved = await resolveInviteRole(userId, { roleId, role });
  if ("error" in resolved) { res.status(400).json({ error: resolved.error }); return; }
  const { roleId: resolvedRoleId, roleName, legacyRole } = resolved;

  const [member] = await db.select().from(teamMembersTable).where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.ownerUserId, userId)));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  const [updated] = await db.update(teamMembersTable)
    .set({ role: roleName, roleId: resolvedRoleId })
    .where(eq(teamMembersTable.id, id))
    .returning();

  if (member.status === "active" && member.memberUserId) {
    await syncTeamMemberWorkspaceMemberships({
      ownerUserId: userId,
      memberUserId: member.memberUserId,
      invitedEmail: member.invitedEmail,
      invitedName: member.invitedName,
      roleId: resolvedRoleId,
      legacyRole,
    });
  }

  res.json(updated);
});

// ─── Remove / revoke member ───────────────────────────────────────────────────
router.delete("/team/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [member] = await db.select().from(teamMembersTable).where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.ownerUserId, userId)));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  await db.update(teamMembersTable).set({ status: "revoked", memberUserId: null, isDeleted: 1, deletedAt: new Date() }).where(eq(teamMembersTable.id, id));
  res.json({ ok: true });
});

// ─── Get invite details by token (public) ────────────────────────────────────
router.get("/invite/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const [invite] = await db.select({
    id: teamMembersTable.id,
    invitedEmail: teamMembersTable.invitedEmail,
    invitedName: teamMembersTable.invitedName,
    role: teamMembersTable.role,
    status: teamMembersTable.status,
    invitedAt: teamMembersTable.invitedAt,
    ownerUserId: teamMembersTable.ownerUserId,
  }).from(teamMembersTable).where(eq(teamMembersTable.inviteToken, token));

  if (!invite) { res.status(404).json({ error: "Invite not found or expired" }); return; }
  if (invite.status === "revoked") { res.status(410).json({ error: "This invite has been revoked" }); return; }
  if (invite.status === "active") { res.status(409).json({ error: "This invite has already been accepted" }); return; }

  res.json(invite);
});

// ─── Accept invite (auth required) ───────────────────────────────────────────
router.post("/invite/:token/accept", requireAuth, async (req, res): Promise<void> => {
  await ensureTeamMembersRoleId();
  const userId = (req as AuthedRequest).userId;
  const token = String(req.params.token ?? "");
  const auth = getAuth(req);
  const sessionEmail = auth?.sessionClaims?.email as string | undefined;

  const [invite] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.inviteToken, token));
  if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
  if (invite.status === "revoked") { res.status(410).json({ error: "This invite has been revoked" }); return; }
  if (invite.status === "active") { res.status(409).json({ error: "Already accepted" }); return; }

  if (sessionEmail && sessionEmail.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
    res.status(403).json({
      error: `This invite was sent to ${invite.invitedEmail}. Sign in with that email to accept.`,
    });
    return;
  }

  // Check this user is not already a member of this workspace
  const existingMembership = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, invite.ownerUserId), eq(teamMembersTable.memberUserId, userId)));
  if (existingMembership.length > 0) {
    res.status(409).json({ error: "You are already a member of this workspace" });
    return;
  }

  await db.update(teamMembersTable)
    .set({ status: "active", memberUserId: userId, acceptedAt: new Date() })
    .where(eq(teamMembersTable.inviteToken, token));

  let legacyRoleKey = "editor";
  if (invite.roleId) {
    const accountRole = await getAccountRole(invite.ownerUserId, invite.roleId);
    if (accountRole?.legacyRoleKey && ["admin", "editor", "viewer"].includes(accountRole.legacyRoleKey)) {
      legacyRoleKey = accountRole.legacyRoleKey;
    }
  } else if (["admin", "editor", "viewer"].includes(invite.role)) {
    legacyRoleKey = invite.role;
  }

  await syncTeamMemberWorkspaceMemberships({
    ownerUserId: invite.ownerUserId,
    memberUserId: userId,
    invitedEmail: invite.invitedEmail,
    invitedName: invite.invitedName,
    roleId: invite.roleId,
    legacyRole: legacyRoleKey,
  });

  // Team members join an existing workspace — skip owner onboarding/plan selection
  await upsertUserProfile(userId, { onboardingCompleted: true });

  // Send welcome email when team notifications are enabled for this user
  try {
    if (await shouldSendTeamWelcomeEmailToUser(userId)) {
      const [ownerProfile] = await db.select({ companyName: userProfilesTable.companyName }).from(userProfilesTable).where(eq(userProfilesTable.userId, invite.ownerUserId));
      const companyName = ownerProfile?.companyName ?? "SellerLens";
      const html = welcomeEmailTemplate({ companyName, memberName: invite.invitedName, role: invite.role });
      await sendEmail({ to: invite.invitedEmail, subject: `Welcome to ${companyName}!`, html });
    }
  } catch (emailErr) {
    req.log?.warn?.({ emailErr }, "Failed to send welcome email");
  }

  void createNotification({
    userId: invite.ownerUserId,
    type: "team_invite_accepted",
    title: "Team member joined",
    message: `${invite.invitedName?.trim() || invite.invitedEmail} accepted your team invite (${invite.role}).`,
    link: "/settings/team",
  });

  const defaultWorkspaceId = await getDefaultWorkspaceId(invite.ownerUserId);

  res.json({
    ok: true,
    ownerUserId: invite.ownerUserId,
    role: invite.role,
    roleId: invite.roleId,
    defaultWorkspaceId,
  });
});

// ─── Update member credit allocation (deprecated — use workspace member credits API) ───
router.patch("/team/:id/credits", requireAuth, async (req, res): Promise<void> => {
  res.status(400).json({
    error: "Allocate credits per workspace: fund pools on Workspaces, then workspace admins assign members on the workspace Members page.",
  });
});

// ─── Member's own workspace context ──────────────────────────────────────────
router.get("/team/membership", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const memberships = await db.select({
    id: teamMembersTable.id,
    ownerUserId: teamMembersTable.ownerUserId,
    role: teamMembersTable.role,
    roleId: teamMembersTable.roleId,
    status: teamMembersTable.status,
    invitedName: teamMembersTable.invitedName,
    acceptedAt: teamMembersTable.acceptedAt,
  }).from(teamMembersTable)
    .where(and(eq(teamMembersTable.memberUserId, userId), eq(teamMembersTable.status, "active")));

  const enriched = await Promise.all(memberships.map(async (m) => {
    const [ownerProfile] = await db
      .select({ companyName: userProfilesTable.companyName, fullName: userProfilesTable.fullName })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, m.ownerUserId));
    return {
      ...m,
      workspaceName: ownerProfile?.companyName ?? ownerProfile?.fullName ?? "Workspace",
    };
  }));

  res.json(enriched);
});

// ─── Member usage for billing period (team members) ────────────────────────────
router.get("/team/membership/usage", requireAuth, async (req, res): Promise<void> => {
  await ensureWorkspaceCreditsMigrated();
  const userId = (req as AuthedRequest).userId;
  const workspaceIdParam = req.query.workspaceId;
  const workspaceId = workspaceIdParam != null ? Number(workspaceIdParam) : null;
  const [membership] = await db.select({
    id: teamMembersTable.id,
    ownerUserId: teamMembersTable.ownerUserId,
  }).from(teamMembersTable)
    .where(and(eq(teamMembersTable.memberUserId, userId), eq(teamMembersTable.status, "active")));

  if (!membership) { res.status(404).json({ error: "Not a team member" }); return; }

  const [sub] = await db.select({
    planName: plansTable.name,
    currentPeriodStart: subscriptionsTable.currentPeriodStart,
    currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
    planAiCredits: plansTable.aiCredits,
    planImageCredits: plansTable.imageCredits,
    planAuditCredits: plansTable.auditCredits,
  }).from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, membership.ownerUserId));

  const periodStart = sub?.currentPeriodStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd = sub?.currentPeriodEnd ?? new Date();
  const creditsUsed = await sumCreditsUsedInPeriod(userId, periodStart, periodEnd);
  const effectiveWorkspaceId = workspaceId && Number.isFinite(workspaceId) && workspaceId > 0
    ? workspaceId
    : await getDefaultWorkspaceId(membership.ownerUserId);
  const remaining = effectiveWorkspaceId
    ? await getMemberCredits(membership.id, effectiveWorkspaceId)
    : await getMemberCredits(membership.id);
  const remainingCredits = remaining ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const remainingTotal = remainingCredits.aiCredits + remainingCredits.imageCredits + remainingCredits.auditCredits;
  const totalAllocatedCredits = remainingTotal + creditsUsed;
  const [ownerProfile] = await db
    .select({ companyName: userProfilesTable.companyName, fullName: userProfilesTable.fullName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, membership.ownerUserId));

  res.json({
    workspaceName: ownerProfile?.companyName ?? ownerProfile?.fullName ?? "Workspace",
    planName: sub?.planName ?? null,
    periodStart,
    periodEnd,
    creditsUsed,
    remainingCredits,
    totalAllocatedCredits,
    allocatedCredits: remainingCredits,
    workspacePlanTotal: sub
      ? (sub.planAiCredits ?? 0) + (sub.planImageCredits ?? 0) + (sub.planAuditCredits ?? 0)
      : 0,
  });
});

// ─── Member's own credit balance ─────────────────────────────────────────────
router.get("/team/membership/credits", requireAuth, async (req, res): Promise<void> => {
  await ensureWorkspaceCreditsMigrated();
  const userId = (req as AuthedRequest).userId;
  const workspaceIdParam = req.query.workspaceId;
  const workspaceId = workspaceIdParam != null ? Number(workspaceIdParam) : null;
  const [membership] = await db.select({ id: teamMembersTable.id, ownerUserId: teamMembersTable.ownerUserId })
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.memberUserId, userId), eq(teamMembersTable.status, "active")));
  if (!membership) { res.status(404).json({ error: "Not a team member" }); return; }

  const effectiveWorkspaceId = workspaceId && Number.isFinite(workspaceId) && workspaceId > 0
    ? workspaceId
    : await getDefaultWorkspaceId(membership.ownerUserId);
  const credits = effectiveWorkspaceId
    ? await getMemberCredits(membership.id, effectiveWorkspaceId)
    : await getMemberCredits(membership.id);
  res.json({ memberId: membership.id, workspaceId: effectiveWorkspaceId, credits: credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 } });
});

export default router;
