import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, count, avg, sql, desc, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, auditsTable, competitorsTable, plansTable, creditsTable, creditTransactionsTable } from "@workspace/db";

const router: IRouter = Router();

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? "";

interface AdminRequest extends Request {
  adminUserId: string;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  (req as AdminRequest).adminUserId = userId;
  next();
}

async function clerkFetch(path: string, options?: RequestInit) {
  const resp = await fetch(`https://api.clerk.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  return resp.json();
}

router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const [auditStats] = await db
    .select({
      totalAudits: count(),
      averageScore: avg(auditsTable.overallScore),
    })
    .from(auditsTable);

  const statusCounts = await db
    .select({ status: auditsTable.status, c: count() })
    .from(auditsTable)
    .groupBy(auditsTable.status);

  const [highScore] = await db
    .select({ c: count() })
    .from(auditsTable)
    .where(sql`${auditsTable.overallScore} >= 70`);

  const [lowScore] = await db
    .select({ c: count() })
    .from(auditsTable)
    .where(sql`${auditsTable.overallScore} < 50`);

  const clerkUsers = await clerkFetch("/users?limit=1") as Record<string, any>;
  const totalUsers = clerkUsers?.total_count ?? 0;

  const recentAudits = await db
    .select({
      id: auditsTable.id,
      userId: auditsTable.userId,
      productName: auditsTable.productName,
      overallScore: auditsTable.overallScore,
      status: auditsTable.status,
      createdAt: auditsTable.createdAt,
    })
    .from(auditsTable)
    .orderBy(desc(auditsTable.createdAt))
    .limit(10);

  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) {
    statusMap[row.status] = Number(row.c);
  }

  res.json({
    totalUsers,
    totalAudits: Number(auditStats?.totalAudits ?? 0),
    averageScore: Math.round(Number(auditStats?.averageScore ?? 0)),
    highScoreCount: Number(highScore?.c ?? 0),
    lowScoreCount: Number(lowScore?.c ?? 0),
    auditsByStatus: statusMap,
    recentAudits,
  });
});

router.get("/admin/customers", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const query = (req.query.query as string | undefined) ?? "";

  const searchParam = query ? `&query=${encodeURIComponent(query)}` : "";
  const clerkData = await clerkFetch(`/users?limit=${limit}&offset=${offset}${searchParam}&order_by=-created_at`) as Record<string, any>;
  const users: Array<Record<string, unknown>> = Array.isArray(clerkData) ? clerkData : (clerkData?.data ?? []);

  const auditCounts = await db
    .select({ userId: auditsTable.userId, c: count() })
    .from(auditsTable)
    .groupBy(auditsTable.userId);

  const countMap: Record<string, number> = {};
  for (const row of auditCounts) {
    countMap[row.userId] = Number(row.c);
  }

  const customers = users.map((u: Record<string, unknown>) => ({
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    email: (u.email_addresses as Array<{email_address: string}> | undefined)?.[0]?.email_address ?? "",
    imageUrl: u.image_url,
    banned: u.banned,
    locked: u.locked,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at,
    auditCount: countMap[u.id as string] ?? 0,
    publicMetadata: u.public_metadata,
  }));

  res.json({ customers, total: (clerkData as Record<string, any>)?.total_count ?? users.length });
});

router.get("/admin/customers/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const clerkUser = await clerkFetch(`/users/${userId}`) as Record<string, any>;
  if (clerkUser?.errors) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userAudits = await db
    .select({
      id: auditsTable.id,
      productName: auditsTable.productName,
      overallScore: auditsTable.overallScore,
      status: auditsTable.status,
      createdAt: auditsTable.createdAt,
    })
    .from(auditsTable)
    .where(eq(auditsTable.userId, userId))
    .orderBy(desc(auditsTable.createdAt))
    .limit(20);

  const [auditStats] = await db
    .select({ total: count(), avg: avg(auditsTable.overallScore) })
    .from(auditsTable)
    .where(eq(auditsTable.userId, userId));

  const [credits] = await db
    .select()
    .from(creditsTable)
    .where(eq(creditsTable.userId, userId));

  const transactions = await db
    .select()
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, userId))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(20);

  res.json({
    user: {
      id: clerkUser.id,
      firstName: clerkUser.first_name,
      lastName: clerkUser.last_name,
      email: clerkUser.email_addresses?.[0]?.email_address ?? "",
      imageUrl: clerkUser.image_url,
      banned: clerkUser.banned,
      locked: clerkUser.locked,
      createdAt: clerkUser.created_at,
      lastSignInAt: clerkUser.last_sign_in_at,
      publicMetadata: clerkUser.public_metadata,
    },
    audits: userAudits,
    auditStats: {
      total: Number(auditStats?.total ?? 0),
      averageScore: Math.round(Number(auditStats?.avg ?? 0)),
    },
    credits: credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 },
    transactions,
  });
});

router.patch("/admin/customers/:userId/ban", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const result = await clerkFetch(`/users/${userId}/ban`, { method: "POST" });
  res.json(result);
});

router.patch("/admin/customers/:userId/unban", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const result = await clerkFetch(`/users/${userId}/unban`, { method: "POST" });
  res.json(result);
});

router.delete("/admin/customers/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  await db.delete(auditsTable).where(eq(auditsTable.userId, userId));
  await clerkFetch(`/users/${userId}`, { method: "DELETE" });
  res.sendStatus(204);
});

router.get("/admin/audits", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const audits = await db
    .select({
      id: auditsTable.id,
      userId: auditsTable.userId,
      productName: auditsTable.productName,
      asin: auditsTable.asin,
      category: auditsTable.category,
      overallScore: auditsTable.overallScore,
      status: auditsTable.status,
      createdAt: auditsTable.createdAt,
    })
    .from(auditsTable)
    .orderBy(desc(auditsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db.select({ c: count() }).from(auditsTable);

  res.json({ audits, total: Number(total?.c ?? 0) });
});

router.delete("/admin/audits/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(competitorsTable).where(eq(competitorsTable.auditId, id));
  await db.delete(auditsTable).where(eq(auditsTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/plans", requireAdmin, async (req, res): Promise<void> => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.priceMonthly);
  res.json(plans);
});

router.post("/admin/plans", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, priceMonthly, priceYearly, aiCredits, imageCredits, auditCredits, teamMembers, features } = req.body;
  const [plan] = await db
    .insert(plansTable)
    .values({ name, description, priceMonthly, priceYearly, aiCredits, imageCredits, auditCredits, teamMembers: teamMembers ?? 1, features: features ?? [] })
    .returning();
  res.status(201).json(plan);
});

router.patch("/admin/plans/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, description, priceMonthly, priceYearly, aiCredits, imageCredits, auditCredits, teamMembers, features, isActive } = req.body;
  const [plan] = await db
    .update(plansTable)
    .set({ name, description, priceMonthly, priceYearly, aiCredits, imageCredits, auditCredits, teamMembers, features, isActive, updatedAt: new Date() })
    .where(eq(plansTable.id, id))
    .returning();
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(plan);
});

router.delete("/admin/plans/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(plansTable).where(eq(plansTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/credits", requireAdmin, async (req, res): Promise<void> => {
  const allCredits = await db
    .select()
    .from(creditsTable)
    .orderBy(desc(creditsTable.updatedAt))
    .limit(100);
  res.json(allCredits);
});

router.post("/admin/credits/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const { aiCredits = 0, imageCredits = 0, auditCredits = 0, reason = "Admin adjustment" } = req.body;

  const [existing] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  if (existing) {
    await db
      .update(creditsTable)
      .set({
        aiCredits: Math.max(0, existing.aiCredits + aiCredits),
        imageCredits: Math.max(0, existing.imageCredits + imageCredits),
        auditCredits: Math.max(0, existing.auditCredits + auditCredits),
        updatedAt: new Date(),
      })
      .where(eq(creditsTable.userId, userId));
  } else {
    await db.insert(creditsTable).values({
      userId,
      aiCredits: Math.max(0, aiCredits),
      imageCredits: Math.max(0, imageCredits),
      auditCredits: Math.max(0, auditCredits),
    });
  }

  for (const [type, amount] of [["ai", aiCredits], ["image", imageCredits], ["audit", auditCredits]] as [string, number][]) {
    if (amount !== 0) {
      await db.insert(creditTransactionsTable).values({ userId, creditType: type, amount, reason });
    }
  }

  const [updated] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  res.json(updated);
});

router.get("/admin/analytics", requireAdmin, async (req, res): Promise<void> => {
  const auditsByDay = await db
    .select({
      day: sql<string>`DATE(${auditsTable.createdAt})`.as("day"),
      count: count(),
      avgScore: avg(auditsTable.overallScore),
    })
    .from(auditsTable)
    .where(sql`${auditsTable.createdAt} >= NOW() - INTERVAL '30 days'`)
    .groupBy(sql`DATE(${auditsTable.createdAt})`)
    .orderBy(sql`DATE(${auditsTable.createdAt})`);

  const scoreDistribution = await db
    .select({
      bucket: sql<string>`
        CASE
          WHEN ${auditsTable.overallScore} >= 80 THEN 'Excellent (80-100)'
          WHEN ${auditsTable.overallScore} >= 60 THEN 'Good (60-79)'
          WHEN ${auditsTable.overallScore} >= 40 THEN 'Fair (40-59)'
          ELSE 'Poor (0-39)'
        END
      `.as("bucket"),
      count: count(),
    })
    .from(auditsTable)
    .where(sql`${auditsTable.status} = 'complete'`)
    .groupBy(sql`
      CASE
        WHEN ${auditsTable.overallScore} >= 80 THEN 'Excellent (80-100)'
        WHEN ${auditsTable.overallScore} >= 60 THEN 'Good (60-79)'
        WHEN ${auditsTable.overallScore} >= 40 THEN 'Fair (40-59)'
        ELSE 'Poor (0-39)'
      END
    `);

  const topUsers = await db
    .select({
      userId: auditsTable.userId,
      auditCount: count(),
      avgScore: avg(auditsTable.overallScore),
    })
    .from(auditsTable)
    .groupBy(auditsTable.userId)
    .orderBy(desc(count()))
    .limit(10);

  const categoryBreakdown = await db
    .select({ category: auditsTable.category, c: count(), avg: avg(auditsTable.overallScore) })
    .from(auditsTable)
    .where(sql`${auditsTable.category} IS NOT NULL`)
    .groupBy(auditsTable.category)
    .orderBy(desc(count()))
    .limit(10);

  res.json({ auditsByDay, scoreDistribution, topUsers, categoryBreakdown });
});

export default router;
