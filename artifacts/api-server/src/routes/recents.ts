import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable, graphicsProjectsTable, videosProjectsTable, adsProjectsTable } from "@workspace/db";

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

  const [audits, graphics, videos, ads] = await Promise.all([
    db
      .select({
        id: auditsTable.id,
        name: auditsTable.productName,
        createdAt: auditsTable.createdAt,
      })
      .from(auditsTable)
      .where(and(eq(auditsTable.userId, userId), eq(auditsTable.isDeleted, 0)))
      .orderBy(desc(auditsTable.createdAt))
      .limit(limit),
    db
      .select({
        id: graphicsProjectsTable.id,
        name: graphicsProjectsTable.name,
        createdAt: graphicsProjectsTable.createdAt,
      })
      .from(graphicsProjectsTable)
      .where(and(eq(graphicsProjectsTable.userId, userId), eq(graphicsProjectsTable.isDeleted, 0)))
      .orderBy(desc(graphicsProjectsTable.createdAt))
      .limit(limit),
    db
      .select({
        id: videosProjectsTable.id,
        name: videosProjectsTable.name,
        createdAt: videosProjectsTable.createdAt,
      })
      .from(videosProjectsTable)
      .where(and(eq(videosProjectsTable.userId, userId), eq(videosProjectsTable.isDeleted, 0)))
      .orderBy(desc(videosProjectsTable.createdAt))
      .limit(limit),
    db
      .select({
        id: adsProjectsTable.id,
        name: adsProjectsTable.name,
        createdAt: adsProjectsTable.createdAt,
      })
      .from(adsProjectsTable)
      .where(and(eq(adsProjectsTable.userId, userId), eq(adsProjectsTable.isDeleted, 0)))
      .orderBy(desc(adsProjectsTable.createdAt))
      .limit(limit),
  ]);

  const items = [
    ...audits.map((a) => ({ type: "audit" as const, id: a.id, name: a.name, createdAt: a.createdAt, url: `/audits/${a.id}` })),
    ...graphics.map((g) => ({ type: "graphics" as const, id: g.id, name: g.name, createdAt: g.createdAt, url: `/projects/${g.id}` })),
    ...videos.map((v) => ({ type: "video" as const, id: v.id, name: v.name, createdAt: v.createdAt, url: `/videos/${v.id}` })),
    ...ads.map((a) => ({ type: "ads" as const, id: a.id, name: a.name, createdAt: a.createdAt, url: `/ads/${a.id}` })),
  ];

  items.sort((a, b) => {
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
      .select({
        id: auditsTable.id,
        name: auditsTable.productName,
        createdAt: auditsTable.createdAt,
      })
      .from(auditsTable)
      .where(and(
        eq(auditsTable.userId, userId),
        eq(auditsTable.isDeleted, 0),
        ilike(auditsTable.productName, `%${q}%`)
      ))
      .orderBy(desc(auditsTable.createdAt))
      .limit(limit),
    db
      .select({
        id: graphicsProjectsTable.id,
        name: graphicsProjectsTable.name,
        createdAt: graphicsProjectsTable.createdAt,
      })
      .from(graphicsProjectsTable)
      .where(and(
        eq(graphicsProjectsTable.userId, userId),
        eq(graphicsProjectsTable.isDeleted, 0),
        ilike(graphicsProjectsTable.name, `%${q}%`)
      ))
      .orderBy(desc(graphicsProjectsTable.createdAt))
      .limit(limit),
    db
      .select({
        id: videosProjectsTable.id,
        name: videosProjectsTable.name,
        createdAt: videosProjectsTable.createdAt,
      })
      .from(videosProjectsTable)
      .where(and(
        eq(videosProjectsTable.userId, userId),
        eq(videosProjectsTable.isDeleted, 0),
        ilike(videosProjectsTable.name, `%${q}%`)
      ))
      .orderBy(desc(videosProjectsTable.createdAt))
      .limit(limit),
    db
      .select({
        id: adsProjectsTable.id,
        name: adsProjectsTable.name,
        createdAt: adsProjectsTable.createdAt,
      })
      .from(adsProjectsTable)
      .where(and(
        eq(adsProjectsTable.userId, userId),
        eq(adsProjectsTable.isDeleted, 0),
        ilike(adsProjectsTable.name, `%${q}%`)
      ))
      .orderBy(desc(adsProjectsTable.createdAt))
      .limit(limit),
  ]);

  const items = [
    ...audits.map((a) => ({ type: "audit" as const, id: a.id, name: a.name, createdAt: a.createdAt, url: `/audits/${a.id}` })),
    ...graphics.map((g) => ({ type: "graphics" as const, id: g.id, name: g.name, createdAt: g.createdAt, url: `/projects/${g.id}` })),
    ...videos.map((v) => ({ type: "video" as const, id: v.id, name: v.name, createdAt: v.createdAt, url: `/videos/${v.id}` })),
    ...ads.map((a) => ({ type: "ads" as const, id: a.id, name: a.name, createdAt: a.createdAt, url: `/ads/${a.id}` })),
  ];

  items.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  res.json({ items: items.slice(0, limit) });
});

export default router;
