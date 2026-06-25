import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  auditsTable,
  graphicsProjectsTable,
  videosProjectsTable,
  adsProjectsTable,
  pinnedProjectsTable,
} from "@workspace/db";

const router: IRouter = Router();

interface AuthedRequest extends Request {
  userId: string;
}

function requireAuth(req: Request, res: Response, next: () => void): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

// GET /recents — unified list of all user projects across all types
router.get("/recents", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const [audits, graphics, videos, ads, pins] = await Promise.all([
    db
      .select({ id: auditsTable.id, name: auditsTable.productName, createdAt: auditsTable.createdAt })
      .from(auditsTable)
      .where(and(eq(auditsTable.userId, userId), eq(auditsTable.isDeleted, 0), sql`${auditsTable.status} != 'archived'`))
      .orderBy(desc(auditsTable.createdAt))
      .limit(limit),
    db
      .select({ id: graphicsProjectsTable.id, name: graphicsProjectsTable.name, createdAt: graphicsProjectsTable.createdAt })
      .from(graphicsProjectsTable)
      .where(and(eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.isDeleted, 0), sql`${graphicsProjectsTable.status} != 'archived'`))
      .orderBy(desc(graphicsProjectsTable.createdAt))
      .limit(limit),
    db
      .select({ id: videosProjectsTable.id, name: videosProjectsTable.name, createdAt: videosProjectsTable.createdAt })
      .from(videosProjectsTable)
      .where(and(eq(videosProjectsTable.userId, userId), eq(videosProjectsTable.isDeleted, 0), sql`${videosProjectsTable.status} != 'archived'`))
      .orderBy(desc(videosProjectsTable.createdAt))
      .limit(limit),
    db
      .select({ id: adsProjectsTable.id, name: adsProjectsTable.name, createdAt: adsProjectsTable.createdAt })
      .from(adsProjectsTable)
      .where(and(eq(adsProjectsTable.userId, userId), eq(adsProjectsTable.isDeleted, 0), sql`${adsProjectsTable.status} != 'archived'`))
      .orderBy(desc(adsProjectsTable.createdAt))
      .limit(limit),
    db
      .select({ itemType: pinnedProjectsTable.itemType, itemId: pinnedProjectsTable.itemId })
      .from(pinnedProjectsTable)
      .where(eq(pinnedProjectsTable.userId, userId)),
  ]);

  const pinnedSet = new Set(pins.map((p) => `${p.itemType}-${p.itemId}`));

  const items = [
    ...audits.map((a) => ({ type: "audit" as const, id: a.id, name: a.name, createdAt: a.createdAt, url: `/audits/${a.id}`, pinned: pinnedSet.has(`audit-${a.id}`) })),
    ...graphics.map((g) => ({ type: "graphics" as const, id: g.id, name: g.name, createdAt: g.createdAt, url: `/projects/${g.id}`, pinned: pinnedSet.has(`graphics-${g.id}`) })),
    ...videos.map((v) => ({ type: "video" as const, id: v.id, name: v.name, createdAt: v.createdAt, url: `/videos/${v.id}`, pinned: pinnedSet.has(`video-${v.id}`) })),
    ...ads.map((a) => ({ type: "ads" as const, id: a.id, name: a.name, createdAt: a.createdAt, url: `/ads/${a.id}`, pinned: pinnedSet.has(`ads-${a.id}`) })),
  ];

  items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  res.json({ items: items.slice(0, limit) });
});

// GET /search/projects — search across all project types
router.get("/search/projects", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  if (!q) {
    res.json({ items: [] });
    return;
  }

  const [audits, graphics, videos, ads] = await Promise.all([
    db
      .select({ id: auditsTable.id, name: auditsTable.productName, createdAt: auditsTable.createdAt })
      .from(auditsTable)
      .where(and(eq(auditsTable.userId, userId), eq(auditsTable.isDeleted, 0), ilike(auditsTable.productName, `%${q}%`)))
      .orderBy(desc(auditsTable.createdAt))
      .limit(limit),
    db
      .select({ id: graphicsProjectsTable.id, name: graphicsProjectsTable.name, createdAt: graphicsProjectsTable.createdAt })
      .from(graphicsProjectsTable)
      .where(and(eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.isDeleted, 0), ilike(graphicsProjectsTable.name, `%${q}%`)))
      .orderBy(desc(graphicsProjectsTable.createdAt))
      .limit(limit),
    db
      .select({ id: videosProjectsTable.id, name: videosProjectsTable.name, createdAt: videosProjectsTable.createdAt })
      .from(videosProjectsTable)
      .where(and(eq(videosProjectsTable.userId, userId), eq(videosProjectsTable.isDeleted, 0), ilike(videosProjectsTable.name, `%${q}%`)))
      .orderBy(desc(videosProjectsTable.createdAt))
      .limit(limit),
    db
      .select({ id: adsProjectsTable.id, name: adsProjectsTable.name, createdAt: adsProjectsTable.createdAt })
      .from(adsProjectsTable)
      .where(and(eq(adsProjectsTable.userId, userId), eq(adsProjectsTable.isDeleted, 0), ilike(adsProjectsTable.name, `%${q}%`)))
      .orderBy(desc(adsProjectsTable.createdAt))
      .limit(limit),
  ]);

  const items = [
    ...audits.map((a) => ({ type: "audit" as const, id: a.id, name: a.name, createdAt: a.createdAt, url: `/audits/${a.id}`, pinned: false })),
    ...graphics.map((g) => ({ type: "graphics" as const, id: g.id, name: g.name, createdAt: g.createdAt, url: `/projects/${g.id}`, pinned: false })),
    ...videos.map((v) => ({ type: "video" as const, id: v.id, name: v.name, createdAt: v.createdAt, url: `/videos/${v.id}`, pinned: false })),
    ...ads.map((a) => ({ type: "ads" as const, id: a.id, name: a.name, createdAt: a.createdAt, url: `/ads/${a.id}`, pinned: false })),
  ];

  items.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  res.json({ items: items.slice(0, limit) });
});

// POST /projects/pin — toggle pin for a project
router.post("/projects/pin", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { type, id } = req.body as { type: string; id: number };
  if (!type || !id) { res.status(400).json({ error: "type and id required" }); return; }

  const existing = await db
    .select()
    .from(pinnedProjectsTable)
    .where(and(eq(pinnedProjectsTable.userId, userId), eq(pinnedProjectsTable.itemType, type), eq(pinnedProjectsTable.itemId, id)));

  if (existing.length > 0) {
    await db.delete(pinnedProjectsTable).where(and(
      eq(pinnedProjectsTable.userId, userId),
      eq(pinnedProjectsTable.itemType, type),
      eq(pinnedProjectsTable.itemId, id),
    ));
    res.json({ pinned: false });
  } else {
    await db.insert(pinnedProjectsTable).values({ userId, itemType: type, itemId: id });
    res.json({ pinned: true });
  }
});

// PATCH /projects/:type/:id/rename — rename a project
router.patch("/projects/:type/:id/rename", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { type, id } = req.params;
  const itemId = Number(id);
  const { name } = req.body as { name: string };
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }

  const trimmed = name.trim();
  switch (type) {
    case "audit":
      await db.update(auditsTable).set({ productName: trimmed, updatedAt: new Date() }).where(and(eq(auditsTable.id, itemId), eq(auditsTable.userId, userId)));
      break;
    case "graphics":
      await db.update(graphicsProjectsTable).set({ name: trimmed, updatedAt: new Date() }).where(and(eq(graphicsProjectsTable.id, itemId), eq(graphicsProjectsTable.userId, userId)));
      break;
    case "video":
      await db.update(videosProjectsTable).set({ name: trimmed, updatedAt: new Date() }).where(and(eq(videosProjectsTable.id, itemId), eq(videosProjectsTable.userId, userId)));
      break;
    case "ads":
      await db.update(adsProjectsTable).set({ name: trimmed, updatedAt: new Date() }).where(and(eq(adsProjectsTable.id, itemId), eq(adsProjectsTable.userId, userId)));
      break;
    default:
      res.status(400).json({ error: "unknown type" }); return;
  }
  res.json({ ok: true, name: trimmed });
});

// PATCH /projects/:type/:id/archive — archive a project
router.patch("/projects/:type/:id/archive", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { type, id } = req.params;
  const itemId = Number(id);

  switch (type) {
    case "audit":
      await db.update(auditsTable).set({ status: "archived", updatedAt: new Date() }).where(and(eq(auditsTable.id, itemId), eq(auditsTable.userId, userId)));
      break;
    case "graphics":
      await db.update(graphicsProjectsTable).set({ status: "archived", updatedAt: new Date() }).where(and(eq(graphicsProjectsTable.id, itemId), eq(graphicsProjectsTable.userId, userId)));
      break;
    case "video":
      await db.update(videosProjectsTable).set({ status: "archived", updatedAt: new Date() }).where(and(eq(videosProjectsTable.id, itemId), eq(videosProjectsTable.userId, userId)));
      break;
    case "ads":
      await db.update(adsProjectsTable).set({ status: "archived", updatedAt: new Date() }).where(and(eq(adsProjectsTable.id, itemId), eq(adsProjectsTable.userId, userId)));
      break;
    default:
      res.status(400).json({ error: "unknown type" }); return;
  }
  res.json({ ok: true });
});

// DELETE /projects/:type/:id — soft delete a project
router.delete("/projects/:type/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { type, id } = req.params;
  const itemId = Number(id);
  const now = new Date();

  switch (type) {
    case "audit":
      await db.update(auditsTable).set({ isDeleted: 1, deletedAt: now, updatedAt: now }).where(and(eq(auditsTable.id, itemId), eq(auditsTable.userId, userId)));
      break;
    case "graphics":
      await db.update(graphicsProjectsTable).set({ isDeleted: 1, deletedAt: now, updatedAt: now }).where(and(eq(graphicsProjectsTable.id, itemId), eq(graphicsProjectsTable.userId, userId)));
      break;
    case "video":
      await db.update(videosProjectsTable).set({ isDeleted: 1, deletedAt: now, updatedAt: now }).where(and(eq(videosProjectsTable.id, itemId), eq(videosProjectsTable.userId, userId)));
      break;
    case "ads":
      await db.update(adsProjectsTable).set({ isDeleted: 1, deletedAt: now, updatedAt: now }).where(and(eq(adsProjectsTable.id, itemId), eq(adsProjectsTable.userId, userId)));
      break;
    default:
      res.status(400).json({ error: "unknown type" }); return;
  }

  await db.delete(pinnedProjectsTable).where(and(
    eq(pinnedProjectsTable.userId, userId),
    eq(pinnedProjectsTable.itemType, type),
    eq(pinnedProjectsTable.itemId, itemId),
  ));

  res.json({ ok: true });
});

export default router;
