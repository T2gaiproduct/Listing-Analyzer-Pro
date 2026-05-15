import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc, count, avg } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { randomBytes } from "crypto";
import {
  db, teamMembersTable, subscriptionsTable, plansTable,
  auditsTable, creditsTable, creditTransactionsTable,
} from "@workspace/db";

const router: IRouter = Router();

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
  const userId = (req as AuthedRequest).userId;

  // Get plan seat limit
  const [sub] = await db.select({
    teamMembers: plansTable.teamMembers,
    planName: plansTable.name,
    status: subscriptionsTable.status,
  }).from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));

  const maxSeats = sub?.teamMembers ?? 1;

  // Get team members
  const members = await db.select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, userId), eq(teamMembersTable.status, "active")))
    .orderBy(desc(teamMembersTable.invitedAt));

  const pending = await db.select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, userId), eq(teamMembersTable.status, "pending")))
    .orderBy(desc(teamMembersTable.invitedAt));

  // For active members, get their audit stats
  const memberStats = await Promise.all(members.map(async (m) => {
    if (!m.memberUserId) return { memberId: m.id, auditCount: 0, lastAudit: null, creditBalance: null };
    const [stats] = await db.select({ total: count(), avg: avg(auditsTable.overallScore) })
      .from(auditsTable).where(eq(auditsTable.userId, m.memberUserId));
    const [lastAuditRow] = await db.select({ createdAt: auditsTable.createdAt, productName: auditsTable.productName })
      .from(auditsTable).where(eq(auditsTable.userId, m.memberUserId)).orderBy(desc(auditsTable.createdAt)).limit(1);
    const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, m.memberUserId));
    return {
      memberId: m.id,
      auditCount: Number(stats?.total ?? 0),
      avgScore: Math.round(Number(stats?.avg ?? 0)),
      lastAudit: lastAuditRow ?? null,
      creditBalance: credits ?? null,
    };
  }));

  res.json({
    maxSeats,
    planName: sub?.planName ?? null,
    planStatus: sub?.status ?? null,
    members: [...members, ...pending],
    memberStats,
  });
});

// ─── Send invite ──────────────────────────────────────────────────────────────
router.post("/team/invite", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { invitedEmail, invitedName, role = "editor" } = req.body as { invitedEmail: string; invitedName: string; role?: string };

  if (!invitedEmail || !invitedName) { res.status(400).json({ error: "Email and name are required" }); return; }

  // Check seat limit
  const [sub] = await db.select({ teamMembers: plansTable.teamMembers })
    .from(subscriptionsTable).leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));
  const maxSeats = sub?.teamMembers ?? 1;

  const existing = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, userId)));
  const activeOrPending = existing.filter((m) => m.status !== "revoked");

  if (activeOrPending.length >= maxSeats) {
    res.status(403).json({ error: `Seat limit reached (${maxSeats} seats). Upgrade your plan to invite more members.` });
    return;
  }

  // Check if already invited
  const alreadyInvited = existing.find((m) => m.invitedEmail.toLowerCase() === invitedEmail.toLowerCase() && m.status !== "revoked");
  if (alreadyInvited) { res.status(409).json({ error: "This email has already been invited." }); return; }

  const token = randomBytes(32).toString("hex");
  const [invite] = await db.insert(teamMembersTable).values({
    ownerUserId: userId,
    invitedEmail: invitedEmail.toLowerCase(),
    invitedName,
    role,
    status: "pending",
    inviteToken: token,
  }).returning();

  res.status(201).json({ invite, token });
});

// ─── Change member role ───────────────────────────────────────────────────────
router.patch("/team/:id/role", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { role } = req.body as { role: string };
  if (!["admin", "editor", "viewer"].includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }

  const [member] = await db.select().from(teamMembersTable).where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.ownerUserId, userId)));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  const [updated] = await db.update(teamMembersTable).set({ role }).where(eq(teamMembersTable.id, id)).returning();
  res.json(updated);
});

// ─── Remove / revoke member ───────────────────────────────────────────────────
router.delete("/team/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [member] = await db.select().from(teamMembersTable).where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.ownerUserId, userId)));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  await db.update(teamMembersTable).set({ status: "revoked", memberUserId: null }).where(eq(teamMembersTable.id, id));
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
  const userId = (req as AuthedRequest).userId;
  const token = String(req.params.token ?? "");

  const [invite] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.inviteToken, token));
  if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
  if (invite.status === "revoked") { res.status(410).json({ error: "This invite has been revoked" }); return; }
  if (invite.status === "active") { res.status(409).json({ error: "Already accepted" }); return; }

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

  res.json({ ok: true, ownerUserId: invite.ownerUserId, role: invite.role });
});

// ─── Member's own workspace context ──────────────────────────────────────────
router.get("/team/membership", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const memberships = await db.select({
    id: teamMembersTable.id,
    ownerUserId: teamMembersTable.ownerUserId,
    role: teamMembersTable.role,
    status: teamMembersTable.status,
    invitedName: teamMembersTable.invitedName,
    acceptedAt: teamMembersTable.acceptedAt,
  }).from(teamMembersTable)
    .where(and(eq(teamMembersTable.memberUserId, userId), eq(teamMembersTable.status, "active")));
  res.json(memberships);
});

export default router;
