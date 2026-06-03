import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db, auditsTable, competitorsTable, graphicsProjectsTable, teamMembersTable,
} from "@workspace/db";
import { resolveTeamContext, type TeamAuthedRequest } from "../middlewares/team-auth";

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

async function resolveTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;
  next();
}

function getEffectiveUserId(req: Request): string {
  const team = (req as TeamAuthedRequest).team;
  return team?.ownerUserId ?? (req as AuthedRequest).userId;
}

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

// ─── List archived items ─────────────────────────────────────────────────────
router.get("/archive", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const ownerId = getEffectiveUserId(req);
  const admin = isAdmin(userId);

  const auditWhere = admin ? eq(auditsTable.isDeleted, 1) : and(eq(auditsTable.isDeleted, 1), eq(auditsTable.userId, ownerId));
  const projectWhere = admin ? eq(graphicsProjectsTable.isDeleted, 1) : and(eq(graphicsProjectsTable.isDeleted, 1), eq(graphicsProjectsTable.userId, ownerId));
  const teamWhere = admin ? eq(teamMembersTable.isDeleted, 1) : and(eq(teamMembersTable.isDeleted, 1), eq(teamMembersTable.ownerUserId, ownerId));

  const audits = await db
    .select({ id: auditsTable.id, userId: auditsTable.userId, productName: auditsTable.productName, asin: auditsTable.asin, category: auditsTable.category, overallScore: auditsTable.overallScore, status: auditsTable.status, deletedAt: auditsTable.deletedAt, createdAt: auditsTable.createdAt })
    .from(auditsTable).where(auditWhere).orderBy(desc(auditsTable.deletedAt));

  const projects = await db
    .select({ id: graphicsProjectsTable.id, userId: graphicsProjectsTable.userId, name: graphicsProjectsTable.name, productName: graphicsProjectsTable.productName, status: graphicsProjectsTable.status, deletedAt: graphicsProjectsTable.deletedAt, createdAt: graphicsProjectsTable.createdAt })
    .from(graphicsProjectsTable).where(projectWhere).orderBy(desc(graphicsProjectsTable.deletedAt));

  // Competitors join audits to scope by owner
  const competitorRows = await db
    .select({
      id: competitorsTable.id,
      productName: competitorsTable.productName,
      asin: competitorsTable.asin,
      overallScore: competitorsTable.overallScore,
      auditId: competitorsTable.auditId,
      deletedAt: competitorsTable.deletedAt,
      createdAt: competitorsTable.createdAt,
    })
    .from(competitorsTable)
    .innerJoin(auditsTable, eq(competitorsTable.auditId, auditsTable.id))
    .where(
      admin
        ? eq(competitorsTable.isDeleted, 1)
        : and(eq(competitorsTable.isDeleted, 1), eq(auditsTable.userId, ownerId))
    )
    .orderBy(desc(competitorsTable.deletedAt));

  const teamMembers = await db
    .select({ id: teamMembersTable.id, ownerUserId: teamMembersTable.ownerUserId, invitedEmail: teamMembersTable.invitedEmail, invitedName: teamMembersTable.invitedName, role: teamMembersTable.role, status: teamMembersTable.status, deletedAt: teamMembersTable.deletedAt, invitedAt: teamMembersTable.invitedAt })
    .from(teamMembersTable).where(teamWhere).orderBy(desc(teamMembersTable.deletedAt));

  res.json({
    audits: audits.map(a => ({ ...a, type: "audit" })),
    projects: projects.map(p => ({ ...p, type: "project" })),
    competitors: competitorRows.map(c => ({ ...c, type: "competitor" })),
    teamMembers: teamMembers.map(m => ({ ...m, type: "teamMember" })),
  });
});

// ─── Recover archived item ───────────────────────────────────────────────────
router.post("/archive/:type/:id/recover", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const userId = (req as AuthedRequest).userId;
  const admin = isAdmin(userId);
  const type = String(req.params.type);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  let result;
  switch (type) {
    case "audit": {
      const where = admin ? and(eq(auditsTable.id, id), eq(auditsTable.isDeleted, 1)) : and(eq(auditsTable.id, id), eq(auditsTable.isDeleted, 1), eq(auditsTable.userId, ownerId));
      const [item] = await db.update(auditsTable).set({ isDeleted: 0, deletedAt: null }).where(where).returning();
      result = item;
      break;
    }
    case "project": {
      const where = admin ? and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.isDeleted, 1)) : and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.isDeleted, 1), eq(graphicsProjectsTable.userId, ownerId));
      const [item] = await db.update(graphicsProjectsTable).set({ isDeleted: 0, deletedAt: null }).where(where).returning();
      result = item;
      break;
    }
    case "competitor": {
      // For competitors we need to verify ownership via the linked audit
      if (admin) {
        const [item] = await db.update(competitorsTable).set({ isDeleted: 0, deletedAt: null }).where(and(eq(competitorsTable.id, id), eq(competitorsTable.isDeleted, 1))).returning();
        result = item;
      } else {
        const rows = await db
          .select({ competitorId: competitorsTable.id })
          .from(competitorsTable)
          .innerJoin(auditsTable, eq(competitorsTable.auditId, auditsTable.id))
          .where(and(eq(competitorsTable.id, id), eq(competitorsTable.isDeleted, 1), eq(auditsTable.userId, ownerId)));
        if (rows.length === 0) { res.status(404).json({ error: "Item not found" }); return; }
        const [item] = await db.update(competitorsTable).set({ isDeleted: 0, deletedAt: null }).where(and(eq(competitorsTable.id, id))).returning();
        result = item;
      }
      break;
    }
    case "teamMember": {
      const [item] = await db.update(teamMembersTable).set({ isDeleted: 0, deletedAt: null, status: "active" }).where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.isDeleted, 1), eq(teamMembersTable.ownerUserId, ownerId))).returning();
      result = item;
      break;
    }
    default:
      res.status(400).json({ error: "Unknown type" });
      return;
  }

  if (!result) { res.status(404).json({ error: "Item not found" }); return; }
  res.json({ success: true, item: result });
});

// ─── Permanently delete archived item ────────────────────────────────────────
router.delete("/archive/:type/:id", requireAuth, resolveTeam, async (req, res): Promise<void> => {
  const ownerId = getEffectiveUserId(req);
  const userId = (req as AuthedRequest).userId;
  const admin = isAdmin(userId);
  const type = String(req.params.type);
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  let result;
  switch (type) {
    case "audit": {
      const where = admin ? and(eq(auditsTable.id, id), eq(auditsTable.isDeleted, 1)) : and(eq(auditsTable.id, id), eq(auditsTable.isDeleted, 1), eq(auditsTable.userId, ownerId));
      const [item] = await db.delete(auditsTable).where(where).returning();
      result = item;
      break;
    }
    case "project": {
      const where = admin ? and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.isDeleted, 1)) : and(eq(graphicsProjectsTable.id, id), eq(graphicsProjectsTable.isDeleted, 1), eq(graphicsProjectsTable.userId, ownerId));
      const [item] = await db.delete(graphicsProjectsTable).where(where).returning();
      result = item;
      break;
    }
    case "competitor": {
      if (admin) {
        const [item] = await db.delete(competitorsTable).where(and(eq(competitorsTable.id, id), eq(competitorsTable.isDeleted, 1))).returning();
        result = item;
      } else {
        const rows = await db
          .select({ competitorId: competitorsTable.id })
          .from(competitorsTable)
          .innerJoin(auditsTable, eq(competitorsTable.auditId, auditsTable.id))
          .where(and(eq(competitorsTable.id, id), eq(competitorsTable.isDeleted, 1), eq(auditsTable.userId, ownerId)));
        if (rows.length === 0) { res.status(404).json({ error: "Item not found" }); return; }
        const [item] = await db.delete(competitorsTable).where(eq(competitorsTable.id, id)).returning();
        result = item;
      }
      break;
    }
    case "teamMember": {
      const [item] = await db.delete(teamMembersTable).where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.isDeleted, 1), eq(teamMembersTable.ownerUserId, ownerId))).returning();
      result = item;
      break;
    }
    default:
      res.status(400).json({ error: "Unknown type" });
      return;
  }

  if (!result) { res.status(404).json({ error: "Item not found" }); return; }
  res.sendStatus(204);
});

export default router;
