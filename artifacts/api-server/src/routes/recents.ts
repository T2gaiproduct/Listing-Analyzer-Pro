import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc, ilike, sql, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  auditsTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
  pinnedProjectsTable,
} from "@workspace/db";
import { createNotification } from "../lib/notifications";
import { resolveTeamContext, type TeamAuthedRequest, requireWriteAccess } from "../middlewares/team-auth";
import {
  getMemberWorkedProjects,
  assertMemberProjectAccess,
  ProjectAccessError,
  type MemberWorkedProjects,
  type WorkedProjectType,
} from "../lib/member-projects";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

async function resolveTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  const team = await resolveTeamContext(userId);
  (req as TeamAuthedRequest).team = team;
  next();
}

function getOwnerUserId(req: Request): string {
  return (req as TeamAuthedRequest).team?.ownerUserId ?? (req as AuthedRequest).userId;
}

function dbProjectType(type: string): WorkedProjectType {
  if (type === "listing" || type === "audit") return "audit";
  return type as WorkedProjectType;
}

function activitySortTime(
  worked: MemberWorkedProjects | null,
  itemType: string,
  id: number,
  createdAt: Date | null,
): number {
  if (worked) {
    const dbType = itemType === "listing" ? "audit" : itemType;
    const last = worked.lastActivityAt.get(`${dbType}-${id}`);
    if (last) return last.getTime();
  }
  return createdAt ? new Date(createdAt).getTime() : 0;
}

async function loadScopedRecents(
  ownerUserId: string,
  memberUserId: string,
  isMember: boolean,
  limit: number,
) {
  const worked = isMember ? await getMemberWorkedProjects(memberUserId) : null;

  const auditIds = worked?.auditIds ?? [];
  const graphicsIds = worked?.graphicsIds ?? [];
  const videoIds = worked?.videoIds ?? [];
  const adsIds = worked?.adsIds ?? [];

  const [audits, graphics, videos, ads] = await Promise.all([
    isMember && auditIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: auditsTable.id,
            name: auditsTable.projectName,
            productName: auditsTable.productName,
            asin: auditsTable.asin,
            createdAt: auditsTable.createdAt,
          })
          .from(auditsTable)
          .where(
            and(
              eq(auditsTable.userId, ownerUserId),
              eq(auditsTable.isDeleted, 0),
              sql`${auditsTable.status} != 'archived'`,
              ...(isMember ? [inArray(auditsTable.id, auditIds)] : []),
            ),
          )
          .orderBy(desc(auditsTable.createdAt))
          .limit(limit),
    isMember && graphicsIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: graphicsProjectsTable.id,
            name: graphicsProjectsTable.name,
            createdAt: graphicsProjectsTable.createdAt,
          })
          .from(graphicsProjectsTable)
          .where(
            and(
              eq(graphicsProjectsTable.userId, ownerUserId),
              eq(graphicsProjectsTable.isDeleted, 0),
              sql`${graphicsProjectsTable.status} != 'archived'`,
              ...(isMember ? [] : [sql`${graphicsProjectsTable.auditId} IS NULL`]),
              ...(isMember ? [inArray(graphicsProjectsTable.id, graphicsIds)] : []),
            ),
          )
          .orderBy(desc(graphicsProjectsTable.createdAt))
          .limit(limit),
    isMember && videoIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: videosProjectsTable.id,
            name: videosProjectsTable.name,
            createdAt: videosProjectsTable.createdAt,
          })
          .from(videosProjectsTable)
          .where(
            and(
              eq(videosProjectsTable.userId, ownerUserId),
              eq(videosProjectsTable.isDeleted, 0),
              sql`${videosProjectsTable.status} != 'archived'`,
              ...(isMember ? [inArray(videosProjectsTable.id, videoIds)] : []),
            ),
          )
          .orderBy(desc(videosProjectsTable.createdAt))
          .limit(limit),
    isMember && adsIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: adsProjectsTable.id,
            name: adsProjectsTable.name,
            createdAt: adsProjectsTable.createdAt,
          })
          .from(adsProjectsTable)
          .where(
            and(
              eq(adsProjectsTable.userId, ownerUserId),
              eq(adsProjectsTable.isDeleted, 0),
              sql`${adsProjectsTable.status} != 'archived'`,
              ...(isMember ? [inArray(adsProjectsTable.id, adsIds)] : []),
            ),
          )
          .orderBy(desc(adsProjectsTable.createdAt))
          .limit(limit),
  ]);

  return { audits, graphics, videos, ads, worked };
}

// GET /recents — unified list of all user projects across all types
router.get("/recents", requireAuth, resolveTeam, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const team = (req as TeamAuthedRequest).team;
  const ownerUserId = getOwnerUserId(req);
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const { audits, graphics, videos, ads, worked } = await loadScopedRecents(
    ownerUserId,
    userId,
    team.isTeamMember,
    limit,
  );

  const pins = await db
    .select({ itemType: pinnedProjectsTable.itemType, itemId: pinnedProjectsTable.itemId })
    .from(pinnedProjectsTable)
    .where(eq(pinnedProjectsTable.userId, userId));

  const pinnedSet = new Set(pins.map((p) => `${p.itemType}-${p.itemId}`));

  const items = [
    ...audits.map((a) => {
      const isAudit = !!a.asin;
      return {
        type: isAudit ? ("audit" as const) : ("listing" as const),
        id: a.id,
        name: a.name || a.productName || "Untitled Project",
        createdAt: a.createdAt,
        url: isAudit ? `/audits/${a.id}` : `/audits/workflow?resume=${a.id}`,
        pinned: pinnedSet.has(`audit-${a.id}`),
      };
    }),
    ...graphics.map((g) => ({
      type: "graphics" as const,
      id: g.id,
      name: g.name,
      createdAt: g.createdAt,
      url: `/projects/${g.id}`,
      pinned: pinnedSet.has(`graphics-${g.id}`),
    })),
    ...videos.map((v) => ({
      type: "video" as const,
      id: v.id,
      name: v.name,
      createdAt: v.createdAt,
      url: `/videos/${v.id}`,
      pinned: pinnedSet.has(`video-${v.id}`),
    })),
    ...ads.map((a) => ({
      type: "ads" as const,
      id: a.id,
      name: a.name,
      createdAt: a.createdAt,
      url: `/ads/${a.id}`,
      pinned: pinnedSet.has(`ads-${a.id}`),
    })),
  ];

  items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = activitySortTime(worked, a.type, a.id, a.createdAt);
    const bTime = activitySortTime(worked, b.type, b.id, b.createdAt);
    return bTime - aTime;
  });

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json({ items: items.slice(0, limit) });
});

// GET /search/projects — search across all project types
router.get("/search/projects", requireAuth, resolveTeam, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const team = (req as TeamAuthedRequest).team;
  const ownerUserId = getOwnerUserId(req);
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  if (!q) {
    res.json({ items: [] });
    return;
  }

  const worked = team.isTeamMember ? await getMemberWorkedProjects(userId) : null;
  const auditIds = worked?.auditIds ?? [];
  const graphicsIds = worked?.graphicsIds ?? [];
  const videoIds = worked?.videoIds ?? [];
  const adsIds = worked?.adsIds ?? [];

  const [audits, graphics, videos, ads] = await Promise.all([
    team.isTeamMember && auditIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: auditsTable.id,
            name: auditsTable.projectName,
            productName: auditsTable.productName,
            asin: auditsTable.asin,
            createdAt: auditsTable.createdAt,
          })
          .from(auditsTable)
          .where(
            and(
              eq(auditsTable.userId, ownerUserId),
              eq(auditsTable.isDeleted, 0),
              sql`${auditsTable.status} != 'archived'`,
              sql`(${auditsTable.productName} ilike ${`%${q}%`} OR ${auditsTable.projectName} ilike ${`%${q}%`})`,
              ...(team.isTeamMember ? [inArray(auditsTable.id, auditIds)] : []),
            ),
          )
          .orderBy(desc(auditsTable.createdAt))
          .limit(limit),
    team.isTeamMember && graphicsIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: graphicsProjectsTable.id,
            name: graphicsProjectsTable.name,
            createdAt: graphicsProjectsTable.createdAt,
          })
          .from(graphicsProjectsTable)
          .where(
            and(
              eq(graphicsProjectsTable.userId, ownerUserId),
              eq(graphicsProjectsTable.isDeleted, 0),
              ilike(graphicsProjectsTable.name, `%${q}%`),
              ...(team.isTeamMember ? [inArray(graphicsProjectsTable.id, graphicsIds)] : []),
            ),
          )
          .orderBy(desc(graphicsProjectsTable.createdAt))
          .limit(limit),
    team.isTeamMember && videoIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: videosProjectsTable.id,
            name: videosProjectsTable.name,
            createdAt: videosProjectsTable.createdAt,
          })
          .from(videosProjectsTable)
          .where(
            and(
              eq(videosProjectsTable.userId, ownerUserId),
              eq(videosProjectsTable.isDeleted, 0),
              ilike(videosProjectsTable.name, `%${q}%`),
              ...(team.isTeamMember ? [inArray(videosProjectsTable.id, videoIds)] : []),
            ),
          )
          .orderBy(desc(videosProjectsTable.createdAt))
          .limit(limit),
    team.isTeamMember && adsIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: adsProjectsTable.id,
            name: adsProjectsTable.name,
            createdAt: adsProjectsTable.createdAt,
          })
          .from(adsProjectsTable)
          .where(
            and(
              eq(adsProjectsTable.userId, ownerUserId),
              eq(adsProjectsTable.isDeleted, 0),
              ilike(adsProjectsTable.name, `%${q}%`),
              ...(team.isTeamMember ? [inArray(adsProjectsTable.id, adsIds)] : []),
            ),
          )
          .orderBy(desc(adsProjectsTable.createdAt))
          .limit(limit),
  ]);

  const items = [
    ...audits.map((a) => {
      const isAudit = !!a.asin;
      return {
        type: isAudit ? ("audit" as const) : ("listing" as const),
        id: a.id,
        name: a.name || a.productName || "Untitled Project",
        createdAt: a.createdAt,
        url: isAudit ? `/audits/${a.id}` : `/audits/workflow?resume=${a.id}`,
        pinned: false,
      };
    }),
    ...graphics.map((g) => ({
      type: "graphics" as const,
      id: g.id,
      name: g.name,
      createdAt: g.createdAt,
      url: `/projects/${g.id}`,
      pinned: false,
    })),
    ...videos.map((v) => ({
      type: "video" as const,
      id: v.id,
      name: v.name,
      createdAt: v.createdAt,
      url: `/videos/${v.id}`,
      pinned: false,
    })),
    ...ads.map((a) => ({
      type: "ads" as const,
      id: a.id,
      name: a.name,
      createdAt: a.createdAt,
      url: `/ads/${a.id}`,
      pinned: false,
    })),
  ];

  items.sort((a, b) => {
    const aTime = activitySortTime(worked, a.type, a.id, a.createdAt);
    const bTime = activitySortTime(worked, b.type, b.id, b.createdAt);
    return bTime - aTime;
  });

  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.json({ items: items.slice(0, limit) });
});

async function ensureProjectMutationAccess(
  req: Request,
  res: Response,
  dbType: string,
  itemId: number,
): Promise<string | null> {
  const userId = (req as AuthedRequest).userId;
  const team = (req as TeamAuthedRequest).team;
  const ownerUserId = getOwnerUserId(req);
  const projectType = dbProjectType(dbType);

  if (team.isTeamMember) {
    try {
      await assertMemberProjectAccess(team, userId, projectType, itemId);
    } catch (err) {
      if (err instanceof ProjectAccessError) {
        res.status(403).json({ error: err.message });
        return null;
      }
      throw err;
    }
    if (team.role === "viewer") {
      res.status(403).json({ error: "Forbidden: viewers cannot modify data" });
      return null;
    }
  }

  return ownerUserId;
}

// POST /projects/pin — toggle pin for a project
router.post("/projects/pin", requireAuth, resolveTeam, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const team = (req as TeamAuthedRequest).team;
  const { type, id } = req.body as { type: string; id: number };
  if (!type || !id) {
    res.status(400).json({ error: "type and id required" });
    return;
  }
  const dbType = type === "listing" ? "audit" : type;

  if (team.isTeamMember) {
    try {
      await assertMemberProjectAccess(team, userId, dbProjectType(type), id);
    } catch (err) {
      if (err instanceof ProjectAccessError) {
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }
  }

  const existing = await db
    .select()
    .from(pinnedProjectsTable)
    .where(
      and(
        eq(pinnedProjectsTable.userId, userId),
        eq(pinnedProjectsTable.itemType, dbType),
        eq(pinnedProjectsTable.itemId, id),
      ),
    );

  const isPinned = existing.length === 0;
  if (isPinned) {
    await db.insert(pinnedProjectsTable).values({ userId, itemType: dbType, itemId: id });
    await createNotification({
      userId,
      type: "project_pinned",
      title: "Project pinned",
      message: `Your ${type} project was pinned to the top of your feed.`,
    });
    res.json({ pinned: true });
  } else {
    await db.delete(pinnedProjectsTable).where(
      and(
        eq(pinnedProjectsTable.userId, userId),
        eq(pinnedProjectsTable.itemType, dbType),
        eq(pinnedProjectsTable.itemId, id),
      ),
    );
    await createNotification({
      userId,
      type: "project_unpinned",
      title: "Project unpinned",
      message: `Your ${type} project was unpinned from your feed.`,
    });
    res.json({ pinned: false });
  }
});

// PATCH /projects/:type/:id/rename — rename a project
router.patch("/projects/:type/:id/rename", requireAuth, resolveTeam, requireWriteAccess, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { type, id } = req.params;
  const itemId = Number(id);
  const dbType = type === "listing" ? "audit" : type;
  const { name } = req.body as { name: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "name required" });
    return;
  }

  const ownerUserId = await ensureProjectMutationAccess(req, res, dbType, itemId);
  if (!ownerUserId) return;

  const trimmed = name.trim();
  switch (dbType) {
    case "audit":
      await db
        .update(auditsTable)
        .set({ projectName: trimmed, updatedAt: new Date() })
        .where(and(eq(auditsTable.id, itemId), eq(auditsTable.userId, ownerUserId)));
      break;
    case "graphics":
      await db
        .update(graphicsProjectsTable)
        .set({ name: trimmed, updatedAt: new Date() })
        .where(and(eq(graphicsProjectsTable.id, itemId), eq(graphicsProjectsTable.userId, ownerUserId)));
      break;
    case "video":
      await db
        .update(videosProjectsTable)
        .set({ name: trimmed, updatedAt: new Date() })
        .where(and(eq(videosProjectsTable.id, itemId), eq(videosProjectsTable.userId, ownerUserId)));
      break;
    case "ads":
      await db
        .update(adsProjectsTable)
        .set({ name: trimmed, updatedAt: new Date() })
        .where(and(eq(adsProjectsTable.id, itemId), eq(adsProjectsTable.userId, ownerUserId)));
      break;
    default:
      res.status(400).json({ error: "unknown type" });
      return;
  }
  await createNotification({
    userId,
    type: "project_renamed",
    title: "Project renamed",
    message: `Your project was renamed to "${trimmed}".`,
  });
  res.json({ ok: true, name: trimmed });
});

// PATCH /projects/:type/:id/archive — archive a project
router.patch("/projects/:type/:id/archive", requireAuth, resolveTeam, requireWriteAccess, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { type, id } = req.params;
  const itemId = Number(id);
  const dbType = type === "listing" ? "audit" : type;

  const ownerUserId = await ensureProjectMutationAccess(req, res, dbType, itemId);
  if (!ownerUserId) return;

  switch (dbType) {
    case "audit":
      await db
        .update(auditsTable)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(auditsTable.id, itemId), eq(auditsTable.userId, ownerUserId)));
      break;
    case "graphics":
      await db
        .update(graphicsProjectsTable)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(graphicsProjectsTable.id, itemId), eq(graphicsProjectsTable.userId, ownerUserId)));
      break;
    case "video":
      await db
        .update(videosProjectsTable)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(videosProjectsTable.id, itemId), eq(videosProjectsTable.userId, ownerUserId)));
      break;
    case "ads":
      await db
        .update(adsProjectsTable)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(adsProjectsTable.id, itemId), eq(adsProjectsTable.userId, ownerUserId)));
      break;
    default:
      res.status(400).json({ error: "unknown type" });
      return;
  }

  await db.delete(pinnedProjectsTable).where(
    and(
      eq(pinnedProjectsTable.userId, userId),
      eq(pinnedProjectsTable.itemType, dbType),
      eq(pinnedProjectsTable.itemId, itemId),
    ),
  );

  await createNotification({
    userId,
    type: "project_archived",
    title: "Project archived",
    message: `Your ${type} project was moved to Archive.`,
    link: "/archive",
  });
  res.json({ ok: true });
});

// DELETE /projects/:type/:id — soft delete a project
router.delete("/projects/:type/:id", requireAuth, resolveTeam, requireWriteAccess, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { type, id } = req.params;
  const itemId = Number(id);
  const dbType = type === "listing" ? "audit" : type;
  const now = new Date();

  const ownerUserId = await ensureProjectMutationAccess(req, res, dbType, itemId);
  if (!ownerUserId) return;

  switch (dbType) {
    case "audit":
      await db
        .update(auditsTable)
        .set({ isDeleted: 1, deletedAt: now, updatedAt: now })
        .where(and(eq(auditsTable.id, itemId), eq(auditsTable.userId, ownerUserId)));
      break;
    case "graphics":
      await db
        .update(graphicsProjectsTable)
        .set({ isDeleted: 1, deletedAt: now, updatedAt: now })
        .where(and(eq(graphicsProjectsTable.id, itemId), eq(graphicsProjectsTable.userId, ownerUserId)));
      break;
    case "video":
      await db
        .update(videosProjectsTable)
        .set({ isDeleted: 1, deletedAt: now, updatedAt: now })
        .where(and(eq(videosProjectsTable.id, itemId), eq(videosProjectsTable.userId, ownerUserId)));
      break;
    case "ads":
      await db
        .update(adsProjectsTable)
        .set({ isDeleted: 1, deletedAt: now, updatedAt: now })
        .where(and(eq(adsProjectsTable.id, itemId), eq(adsProjectsTable.userId, ownerUserId)));
      break;
    default:
      res.status(400).json({ error: "unknown type" });
      return;
  }

  await db.delete(pinnedProjectsTable).where(
    and(
      eq(pinnedProjectsTable.userId, userId),
      eq(pinnedProjectsTable.itemType, dbType),
      eq(pinnedProjectsTable.itemId, itemId),
    ),
  );

  await createNotification({
    userId,
    type: "project_deleted",
    title: "Project deleted",
    message: `Your ${type} project was permanently deleted.`,
  });
  res.json({ ok: true });
});

export default router;
