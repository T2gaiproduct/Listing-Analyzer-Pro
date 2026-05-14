import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, count, avg, sql, desc, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db, auditsTable, competitorsTable, plansTable, creditsTable, creditTransactionsTable,
  paymentsTable, invoicesTable, refundsTable, couponsTable,
  adminRolesTable, adminUsersTable, auditLogsTable, downloadsTable,
  settingsTable, notificationsTable,
} from "@workspace/db";

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
  const nowMs = Date.now();
  const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  const todayStartMs = new Date(new Date().toDateString()).getTime();

  const [auditStats, statusCounts, highScore, lowScore] = await Promise.all([
    db.select({ totalAudits: count(), averageScore: avg(auditsTable.overallScore) }).from(auditsTable),
    db.select({ status: auditsTable.status, c: count() }).from(auditsTable).groupBy(auditsTable.status),
    db.select({ c: count() }).from(auditsTable).where(sql`${auditsTable.overallScore} >= 70`),
    db.select({ c: count() }).from(auditsTable).where(sql`${auditsTable.overallScore} < 50`),
  ]);

  const [clerkUsers, recentSignupsRaw, recentLoginsRaw, newTodayRaw, newWeekRaw, newMonthRaw] = await Promise.all([
    clerkFetch("/users?limit=1") as Promise<Record<string, any>>,
    clerkFetch(`/users?limit=10&order_by=-created_at`) as Promise<Record<string, any>>,
    clerkFetch(`/users?limit=10&order_by=-last_sign_in_at`) as Promise<Record<string, any>>,
    clerkFetch(`/users?limit=1&created_after=${todayStartMs}`) as Promise<Record<string, any>>,
    clerkFetch(`/users?limit=1&created_after=${sevenDaysAgoMs}`) as Promise<Record<string, any>>,
    clerkFetch(`/users?limit=1&created_after=${thirtyDaysAgoMs}`) as Promise<Record<string, any>>,
  ]);

  const totalUsers = (clerkUsers as Record<string, any>)?.total_count ?? 0;

  function mapClerkUser(u: Record<string, any>) {
    return {
      id: u.id,
      firstName: u.first_name ?? "",
      lastName: u.last_name ?? "",
      email: (u.email_addresses as Array<{email_address: string}> | undefined)?.[0]?.email_address ?? "",
      imageUrl: u.image_url ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      banned: u.banned ?? false,
    };
  }

  const recentSignups = ((recentSignupsRaw as Record<string, any>)?.data ?? []).map(mapClerkUser);
  const recentLogins = ((recentLoginsRaw as Record<string, any>)?.data ?? [])
    .filter((u: Record<string, any>) => u.last_sign_in_at)
    .map(mapClerkUser);

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
    newUsersToday: (newTodayRaw as Record<string, any>)?.total_count ?? 0,
    newUsersThisWeek: (newWeekRaw as Record<string, any>)?.total_count ?? 0,
    newUsersThisMonth: (newMonthRaw as Record<string, any>)?.total_count ?? 0,
    totalAudits: Number(auditStats[0]?.totalAudits ?? 0),
    averageScore: Math.round(Number(auditStats[0]?.averageScore ?? 0)),
    highScoreCount: Number(highScore[0]?.c ?? 0),
    lowScoreCount: Number(lowScore[0]?.c ?? 0),
    auditsByStatus: statusMap,
    recentAudits,
    recentSignups,
    recentLogins,
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

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING — Payments
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/payments", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const status = (req.query.status as string | undefined) ?? "";
  const gateway = (req.query.gateway as string | undefined) ?? "";

  let q = db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt)).limit(limit).offset(offset);
  const all = await q;
  const filtered = all.filter((p) => {
    if (status && p.status !== status) return false;
    if (gateway && p.gateway !== gateway) return false;
    return true;
  });
  const [total] = await db.select({ c: count() }).from(paymentsTable);
  res.json({ payments: filtered, total: Number(total?.c ?? 0) });
});

router.post("/admin/payments", requireAdmin, async (req, res): Promise<void> => {
  const { userId, amount, currency, status, gateway, planId, metadata } = req.body;
  const [p] = await db.insert(paymentsTable).values({ userId, amount, currency, status, gateway, planId, metadata }).returning();
  res.status(201).json(p);
});

router.patch("/admin/payments/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status } = req.body;
  const [p] = await db.update(paymentsTable).set({ status, updatedAt: new Date() }).where(eq(paymentsTable.id, id)).returning();
  res.json(p);
});

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING — Invoices
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/invoices", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const invoices = await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt)).limit(limit).offset(offset);
  const [total] = await db.select({ c: count() }).from(invoicesTable);
  res.json({ invoices, total: Number(total?.c ?? 0) });
});

router.post("/admin/invoices", requireAdmin, async (req, res): Promise<void> => {
  const { userId, amount, currency, status, items, dueDate } = req.body;
  const [inv] = await db.insert(invoicesTable).values({ userId, amount, currency, status, items, dueDate: dueDate ? new Date(dueDate) : null }).returning();
  res.status(201).json(inv);
});

router.patch("/admin/invoices/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, paidAt } = req.body;
  const [inv] = await db.update(invoicesTable).set({ status, paidAt: paidAt ? new Date(paidAt) : null }).where(eq(invoicesTable.id, id)).returning();
  res.json(inv);
});

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING — Refunds
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/refunds", requireAdmin, async (req, res): Promise<void> => {
  const refunds = await db.select().from(refundsTable).orderBy(desc(refundsTable.createdAt)).limit(100);
  res.json({ refunds });
});

router.post("/admin/refunds", requireAdmin, async (req, res): Promise<void> => {
  const { paymentId, userId, amount, reason } = req.body;
  const [r] = await db.insert(refundsTable).values({ paymentId, userId, amount, reason }).returning();
  res.status(201).json(r);
});

router.patch("/admin/refunds/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status } = req.body;
  const [r] = await db.update(refundsTable).set({ status, processedAt: status === "completed" ? new Date() : null }).where(eq(refundsTable.id, id)).returning();
  res.json(r);
});

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING — Coupons
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/coupons", requireAdmin, async (req, res): Promise<void> => {
  const coupons = await db.select().from(couponsTable).orderBy(desc(couponsTable.createdAt));
  res.json({ coupons });
});

router.post("/admin/coupons", requireAdmin, async (req, res): Promise<void> => {
  const { code, description, discountPercent, discountAmount, maxUses, expiryDate, appliesTo } = req.body;
  const [c] = await db.insert(couponsTable).values({
    code, description, discountPercent, discountAmount, maxUses, expiryDate: expiryDate ? new Date(expiryDate) : null, appliesTo,
  }).returning();
  res.status(201).json(c);
});

router.patch("/admin/coupons/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { isActive, usedCount } = req.body;
  const [c] = await db.update(couponsTable).set({ isActive, usedCount }).where(eq(couponsTable.id, id)).returning();
  res.json(c);
});

router.delete("/admin/coupons/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(couponsTable).where(eq(couponsTable.id, id));
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/content", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const content = await db
    .select({
      id: auditsTable.id,
      userId: auditsTable.userId,
      productName: auditsTable.productName,
      generatedContent: auditsTable.generatedContent,
      generatedImages: auditsTable.generatedImages,
      createdAt: auditsTable.createdAt,
    })
    .from(auditsTable)
    .where(sql`${auditsTable.generatedContent} IS NOT NULL OR ${auditsTable.generatedImages} IS NOT NULL`)
    .orderBy(desc(auditsTable.createdAt))
    .limit(limit);
  res.json({ content });
});

router.get("/admin/images", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const images = await db
    .select({
      id: auditsTable.id,
      userId: auditsTable.userId,
      productName: auditsTable.productName,
      generatedImages: auditsTable.generatedImages,
      imageRecords: auditsTable.imageRecords,
      createdAt: auditsTable.createdAt,
    })
    .from(auditsTable)
    .where(sql`${auditsTable.generatedImages} IS NOT NULL OR ${auditsTable.imageRecords} IS NOT NULL`)
    .orderBy(desc(auditsTable.createdAt))
    .limit(limit);
  res.json({ images });
});

router.get("/admin/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(limit);
  res.json({ logs });
});

router.get("/admin/downloads", requireAdmin, async (req, res): Promise<void> => {
  const downloads = await db.select().from(downloadsTable).orderBy(desc(downloadsTable.createdAt)).limit(100);
  res.json({ downloads });
});

router.post("/admin/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const { action, entity, entityId, metadata, ipAddress } = req.body;
  const auth = getAuth(req);
  const adminUserId = auth?.userId ?? "unknown";
  const [log] = await db.insert(auditLogsTable).values({ adminUserId, action, entity, entityId, metadata, ipAddress }).returning();
  res.status(201).json(log);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/roles", requireAdmin, async (req, res): Promise<void> => {
  const roles = await db.select().from(adminRolesTable);
  res.json({ roles });
});

router.post("/admin/roles", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, permissions } = req.body;
  const [role] = await db.insert(adminRolesTable).values({ name, description, permissions: permissions ?? [] }).returning();
  res.status(201).json(role);
});

router.patch("/admin/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, description, permissions } = req.body;
  const [role] = await db.update(adminRolesTable).set({ name, description, permissions }).where(eq(adminRolesTable.id, id)).returning();
  res.json(role);
});

router.delete("/admin/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(adminRolesTable).where(eq(adminRolesTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/admin-users", requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select().from(adminUsersTable);
  res.json({ users });
});

router.post("/admin/admin-users", requireAdmin, async (req, res): Promise<void> => {
  const { userId, roleId } = req.body;
  const [u] = await db.insert(adminUsersTable).values({ userId, roleId }).onConflictDoNothing().returning();
  res.status(201).json(u);
});

router.patch("/admin/admin-users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { roleId } = req.body;
  const [u] = await db.update(adminUsersTable).set({ roleId }).where(eq(adminUsersTable.id, id)).returning();
  res.json(u);
});

router.delete("/admin/admin-users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id));
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/notifications", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const type = (req.query.type as string | undefined) ?? "";
  let q = db.select().from(notificationsTable).orderBy(desc(notificationsTable.sentAt)).limit(limit);
  const all = await q;
  const filtered = type ? all.filter((n) => n.type === type) : all;
  res.json({ notifications: filtered });
});

router.post("/admin/notifications", requireAdmin, async (req, res): Promise<void> => {
  const { userId, type, title, message } = req.body;
  const [n] = await db.insert(notificationsTable).values({ userId: userId ?? null, type, title, message }).returning();
  res.status(201).json(n);
});

router.patch("/admin/notifications/:id/read", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [n] = await db.update(notificationsTable).set({ read: true, readAt: new Date() }).where(eq(notificationsTable.id, id)).returning();
  res.json(n);
});

router.delete("/admin/notifications/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(notificationsTable).where(eq(notificationsTable.id, id));
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const category = (req.query.category as string | undefined) ?? "";
  const all = await db.select().from(settingsTable);
  const filtered = category ? all.filter((s) => s.category === category) : all;
  const map: Record<string, string> = {};
  for (const s of filtered) map[s.key] = s.isSecret ? "***" : s.value;
  res.json(map);
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const { category, settings } = req.body;
  for (const [key, value] of Object.entries(settings as Record<string, string>)) {
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    if (existing) {
      await db.update(settingsTable).set({ value, category, updatedAt: new Date() }).where(eq(settingsTable.key, key));
    } else {
      await db.insert(settingsTable).values({ key, value, category });
    }
  }
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/billing-stats", requireAdmin, async (req, res): Promise<void> => {
  const [revenue] = await db.select({ total: sql<number>`COALESCE(SUM(amount),0)` }).from(paymentsTable).where(eq(paymentsTable.status, "completed"));
  const [pending] = await db.select({ total: sql<number>`COALESCE(SUM(amount),0)` }).from(paymentsTable).where(eq(paymentsTable.status, "pending"));
  const [failed] = await db.select({ total: sql<number>`COALESCE(SUM(amount),0)` }).from(paymentsTable).where(eq(paymentsTable.status, "failed"));
  const [refunded] = await db.select({ total: sql<number>`COALESCE(SUM(amount),0)` }).from(refundsTable).where(eq(refundsTable.status, "completed"));
  const [invoiceCount] = await db.select({ c: count() }).from(invoicesTable);
  const [unpaidInvoices] = await db.select({ c: count() }).from(invoicesTable).where(eq(invoicesTable.status, "unpaid"));
  const [couponCount] = await db.select({ c: count() }).from(couponsTable);
  res.json({
    revenue: Number(revenue?.total ?? 0),
    pendingRevenue: Number(pending?.total ?? 0),
    failedRevenue: Number(failed?.total ?? 0),
    refunded: Number(refunded?.total ?? 0),
    invoiceCount: Number(invoiceCount?.c ?? 0),
    unpaidInvoices: Number(unpaidInvoices?.c ?? 0),
    couponCount: Number(couponCount?.c ?? 0),
  });
});

export default router;
