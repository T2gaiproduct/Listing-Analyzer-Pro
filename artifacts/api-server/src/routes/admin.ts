import crypto from "crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, count, avg, sql, desc, and, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db, auditsTable, competitorsTable, plansTable, creditsTable, creditTransactionsTable,
  paymentsTable, invoicesTable, refundsTable, couponsTable,
  adminRolesTable, adminUsersTable, auditLogsTable, downloadsTable,
  settingsTable, notificationsTable,
  cmsContent, blogPosts, testimonials, seoSettings, navItems, formSubmissions, mediaFiles, cmsPages,
  userProfilesTable, subscriptionsTable, teamMembersTable,
} from "@workspace/db";
import { like, or, ilike } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? "";

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = crypto.randomBytes(16);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

interface AdminRequest extends Request {
  adminUserId: string;
}

async function isAdminUser(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.includes(userId)) return true;
  const [row] = await db.select({ id: adminUsersTable.id })
    .from(adminUsersTable).where(eq(adminUsersTable.userId, userId));
  return !!row;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(403).json({ error: "Forbidden" }); return; }
  isAdminUser(userId).then((ok) => {
    if (!ok) { res.status(403).json({ error: "Forbidden" }); return; }
    (req as AdminRequest).adminUserId = userId;
    next();
  }).catch(() => { res.status(500).json({ error: "Internal server error" }); });
}

// Public (auth-only) endpoint to check admin status — used by frontend AdminRoute
router.get("/admin/is-admin", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.json({ isAdmin: false }); return; }
  const ok = await isAdminUser(userId);
  res.json({ isAdmin: ok });
});

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

  const userIds = users.map((u: Record<string, unknown>) => u.id as string).filter(Boolean);
  const profiles = userIds.length
    ? await db
        .select({ userId: userProfilesTable.userId, id: userProfilesTable.id })
        .from(userProfilesTable)
        .where(inArray(userProfilesTable.userId, userIds))
    : [];
  const profileMap: Record<string, number> = {};
  for (const p of profiles) {
    profileMap[p.userId] = p.id;
  }

  // Auto-create minimal profile rows for any user that doesn't have one yet
  const missingIds = userIds.filter((uid) => profileMap[uid] === undefined);
  if (missingIds.length) {
    const inserted = await db
      .insert(userProfilesTable)
      .values(missingIds.map((uid) => ({ userId: uid })))
      .onConflictDoNothing()
      .returning({ userId: userProfilesTable.userId, id: userProfilesTable.id });
    for (const p of inserted) {
      profileMap[p.userId] = p.id;
    }
  }

  const customers = users.map((u: Record<string, unknown>) => ({
    id: u.id,
    profileId: profileMap[u.id as string] ?? null,
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

  const [userAudits, auditStatsRes, creditsRes, transactions, profileRes, subscriptionRes] = await Promise.all([
    db.select({ id: auditsTable.id, productName: auditsTable.productName, overallScore: auditsTable.overallScore, status: auditsTable.status, createdAt: auditsTable.createdAt })
      .from(auditsTable).where(eq(auditsTable.userId, userId)).orderBy(desc(auditsTable.createdAt)).limit(20),
    db.select({ total: count(), avg: avg(auditsTable.overallScore) }).from(auditsTable).where(eq(auditsTable.userId, userId)),
    db.select().from(creditsTable).where(eq(creditsTable.userId, userId)),
    db.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.userId, userId)).orderBy(desc(creditTransactionsTable.createdAt)).limit(20),
    db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)),
    db.select({ id: subscriptionsTable.id, planId: subscriptionsTable.planId, billingCycle: subscriptionsTable.billingCycle, status: subscriptionsTable.status, trialEndsAt: subscriptionsTable.trialEndsAt, currentPeriodEnd: subscriptionsTable.currentPeriodEnd, autoRenew: subscriptionsTable.autoRenew, planName: plansTable.name, priceMonthly: plansTable.priceMonthly, priceYearly: plansTable.priceYearly })
      .from(subscriptionsTable).leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id)).where(eq(subscriptionsTable.userId, userId)),
  ]);

  const [auditStats] = auditStatsRes;
  const [credits] = creditsRes;
  const [profile] = profileRes;
  const [subscription] = subscriptionRes;

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
    profile: profile ?? null,
    audits: userAudits,
    auditStats: {
      total: Number(auditStats?.total ?? 0),
      averageScore: Math.round(Number(auditStats?.avg ?? 0)),
    },
    credits: credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 },
    transactions,
    subscription: subscription ?? null,
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

router.patch("/admin/customers/:userId/lock", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const result = await clerkFetch(`/users/${userId}/lock`, { method: "POST" });
  res.json(result);
});

router.patch("/admin/customers/:userId/unlock", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const result = await clerkFetch(`/users/${userId}/unlock`, { method: "POST" });
  res.json(result);
});

router.get("/admin/customers/:userId/payments", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const userPayments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(50);
  const userInvoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.userId, userId))
    .orderBy(desc(invoicesTable.createdAt))
    .limit(20);
  res.json({ payments: userPayments, invoices: userInvoices });
});

router.delete("/admin/customers/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  await db.delete(auditsTable).where(eq(auditsTable.userId, userId));
  await clerkFetch(`/users/${userId}`, { method: "DELETE" });
  res.sendStatus(204);
});

router.post("/admin/customers/:userId/reset-password", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const { newPassword: provided } = req.body as { newPassword?: string };
  const newPassword = provided && provided.length >= 8 ? provided : generatePassword();
  const result = await clerkFetch(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ password: newPassword, skip_password_checks: true }),
  }) as Record<string, any>;
  if (result?.errors) {
    res.status(400).json({ error: result.errors?.[0]?.message ?? "Failed to reset password" });
    return;
  }
  res.json({ success: true });
});

router.patch("/admin/customers/:userId/profile", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const { fullName, companyName, phone, country, gstNumber, websiteUrl, teamSize } = req.body as Record<string, string | number>;
  const existing = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  let profile;
  if (existing.length) {
    [profile] = await db.update(userProfilesTable)
      .set({ fullName: fullName as string, companyName: companyName as string, phone: phone as string, country: country as string, gstNumber: gstNumber as string, websiteUrl: websiteUrl as string, teamSize: teamSize ? Number(teamSize) : undefined, updatedAt: new Date() })
      .where(eq(userProfilesTable.userId, userId)).returning();
  } else {
    [profile] = await db.insert(userProfilesTable)
      .values({ userId, fullName: fullName as string, companyName: companyName as string, phone: phone as string, country: country as string, gstNumber: gstNumber as string, websiteUrl: websiteUrl as string, teamSize: teamSize ? Number(teamSize) : undefined })
      .returning();
  }
  res.json(profile);
});

router.patch("/admin/customers/:userId/package", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params.userId);
  const { planId, billingCycle, addCredits } = req.body as { planId: number; billingCycle?: "monthly" | "yearly"; addCredits?: boolean };
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan) { res.status(400).json({ error: "Invalid plan" }); return; }
  const now = new Date();
  const periodEnd = new Date(now);
  const cycle = billingCycle ?? "monthly";
  if (cycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (sub) {
    await db.update(subscriptionsTable)
      .set({ planId: plan.id, billingCycle: cycle, status: "active", trialEndsAt: null, currentPeriodStart: now, currentPeriodEnd: periodEnd, updatedAt: now })
      .where(eq(subscriptionsTable.userId, userId));
  } else {
    await db.insert(subscriptionsTable).values({ userId, planId: plan.id, billingCycle: cycle, status: "active", currentPeriodStart: now, currentPeriodEnd: periodEnd });
  }
  if (addCredits !== false) {
    const [existing] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
    if (existing) {
      await db.update(creditsTable).set({ aiCredits: plan.aiCredits, imageCredits: plan.imageCredits, auditCredits: plan.auditCredits, updatedAt: now }).where(eq(creditsTable.userId, userId));
    } else {
      await db.insert(creditsTable).values({ userId, aiCredits: plan.aiCredits, imageCredits: plan.imageCredits, auditCredits: plan.auditCredits });
    }
    await db.insert(creditTransactionsTable).values([
      { userId, creditType: "ai", amount: plan.aiCredits, reason: `Admin: package changed to ${plan.name}`, featureType: "subscription" },
      { userId, creditType: "image", amount: plan.imageCredits, reason: `Admin: package changed to ${plan.name}`, featureType: "subscription" },
      { userId, creditType: "audit", amount: plan.auditCredits, reason: `Admin: package changed to ${plan.name}`, featureType: "subscription" },
    ]);
  }
  res.json({ ok: true, plan });
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
  const { name, description, priceMonthly, priceYearly, aiCredits, imageCredits, auditCredits, teamMembers, features, excludedFeatures, isTrial, trialDays, tag, sortOrder, isHighlighted, ctaText } = req.body;
  const [plan] = await db
    .insert(plansTable)
    .values({
      name, description, priceMonthly, priceYearly, aiCredits, imageCredits, auditCredits,
      teamMembers: teamMembers ?? 1,
      features: features ?? [],
      excludedFeatures: excludedFeatures ?? [],
      isTrial: isTrial ?? false,
      trialDays: trialDays ?? 0,
      tag: tag ?? null,
      sortOrder: sortOrder ?? 0,
      isHighlighted: isHighlighted ?? false,
      ctaText: ctaText ?? null,
    })
    .returning();
  res.status(201).json(plan);
});

router.patch("/admin/plans/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, description, priceMonthly, priceYearly, aiCredits, imageCredits, auditCredits, teamMembers, features, excludedFeatures, isActive, isTrial, trialDays, tag, sortOrder, isHighlighted, ctaText } = req.body;
  const [plan] = await db
    .update(plansTable)
    .set({ name, description, priceMonthly, priceYearly, aiCredits, imageCredits, auditCredits, teamMembers, features, excludedFeatures, isActive, isTrial, trialDays, tag, sortOrder, isHighlighted, ctaText, updatedAt: new Date() })
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

router.get("/admin/credits/analytics", requireAdmin, async (req, res): Promise<void> => {
  const transactions = await db
    .select()
    .from(creditTransactionsTable)
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(500);

  const featureUsage: Record<string, { ai: number; image: number; audit: number; count: number }> = {};
  const userUsage: Record<string, { ai: number; image: number; audit: number; count: number }> = {};

  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const abs = Math.abs(tx.amount);
    const ft = tx.featureType ?? "other";
    if (!featureUsage[ft]) featureUsage[ft] = { ai: 0, image: 0, audit: 0, count: 0 };
    if (!userUsage[tx.userId]) userUsage[tx.userId] = { ai: 0, image: 0, audit: 0, count: 0 };
    featureUsage[ft].count++;
    userUsage[tx.userId].count++;
    if (tx.creditType === "ai") { featureUsage[ft].ai += abs; userUsage[tx.userId].ai += abs; }
    else if (tx.creditType === "image") { featureUsage[ft].image += abs; userUsage[tx.userId].image += abs; }
    else if (tx.creditType === "audit") { featureUsage[ft].audit += abs; userUsage[tx.userId].audit += abs; }
  }

  const topUsers = Object.entries(userUsage)
    .map(([userId, u]) => ({ userId, ...u, total: u.ai + u.image + u.audit }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const featureBreakdown = Object.entries(featureUsage)
    .map(([feature, u]) => ({ feature, ...u, total: u.ai + u.image + u.audit }))
    .sort((a, b) => b.total - a.total);

  res.json({ transactions: transactions.slice(0, 100), topUsers, featureBreakdown });
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
      await db.insert(creditTransactionsTable).values({ userId, creditType: type, amount, reason, featureType: "admin_adjustment" });
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

router.get("/admin/receipts/:paymentId", requireAdmin, async (req, res): Promise<void> => {
  const paymentId = parseInt(String(req.params.paymentId ?? ""), 10);
  if (isNaN(paymentId)) { res.status(400).json({ error: "Invalid payment ID" }); return; }
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment) { res.status(404).json({ error: "Receipt not found" }); return; }
  try {
    const { buildReceipt } = await import("../lib/receipt.js");
    const pdf = await buildReceipt(paymentId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${String(paymentId).padStart(6, "0")}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    res.send(pdf);
  } catch (err) {
    req.log?.error?.({ err, paymentId }, "Admin receipt generation failed");
    res.status(500).json({ error: "Unable to generate receipt. Please try again later or contact support." });
  }
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

  // Enrich with role name
  const roles = await db.select().from(adminRolesTable);
  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]));

  // Enrich with Clerk user data
  const enriched = await Promise.all(users.map(async (u) => {
    let clerkUser: { email: string; name: string } | null = null;
    try {
      const cu = await clerkFetch(`/users/${u.userId}`) as Record<string, unknown>;
      const emails = cu.email_addresses as Array<{ email_address: string }> | undefined;
      const email = emails?.[0]?.email_address ?? "—";
      const fullName = [cu.first_name as string, cu.last_name as string].filter(Boolean).join(" ") || email;
      clerkUser = { email, name: fullName };
    } catch {}
    return { ...u, role: roleMap[u.roleId] ?? null, clerkUser };
  }));

  res.json({ users: enriched });
});

router.post("/admin/admin-users", requireAdmin, async (req, res): Promise<void> => {
  const { email, roleId } = req.body as { email?: string; roleId: number; userId?: string };
  let targetUserId = req.body.userId as string | undefined;

  // If email provided, look up in Clerk
  if (!targetUserId && email) {
    const result = await clerkFetch(`/users?email_address=${encodeURIComponent(email)}&limit=1`) as Record<string, unknown> | unknown[];
    const usersList = Array.isArray(result) ? result : ((result as Record<string, unknown>).data as unknown[] ?? []);
    if (!usersList.length) { res.status(404).json({ error: "No user found with that email address" }); return; }
    targetUserId = (usersList[0] as Record<string, unknown>).id as string;
  }

  if (!targetUserId) { res.status(400).json({ error: "Provide email or userId" }); return; }

  const [u] = await db.insert(adminUsersTable).values({ userId: targetUserId, roleId })
    .onConflictDoUpdate({ target: adminUsersTable.userId, set: { roleId } })
    .returning();
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

  const SECRET_KEYS = new Set([
    "stripe_secret_key", "stripe_webhook_secret",
    "razorpay_key_secret", "razorpay_webhook_secret",
    "paypal_client_secret",
  ]);

  for (const [key, value] of Object.entries(settings as Record<string, string>)) {
    if (value === "***") continue;
    const isSecret = SECRET_KEYS.has(key);
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    if (existing) {
      await db.update(settingsTable)
        .set({ value, category, isSecret, updatedAt: new Date() })
        .where(eq(settingsTable.key, key));
    } else {
      await db.insert(settingsTable).values({ key, value, category, isSecret });
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

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — CMS CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/cms/:pageSlug", requireAdmin, async (req, res): Promise<void> => {
  const pageSlug = String(req.params.pageSlug ?? "");
  const rows = await db.select().from(cmsContent).where(eq(cmsContent.pageSlug, pageSlug));
  const map: Record<string, string> = {};
  for (const r of rows) { map[`${r.sectionKey}.${r.fieldKey}`] = r.value ?? ""; }
  res.json(map);
});

router.put("/admin/cms/:pageSlug", requireAdmin, async (req, res): Promise<void> => {
  const pageSlug = String(req.params.pageSlug ?? "");
  const data: Record<string, string> = req.body;
  for (const [dotKey, value] of Object.entries(data)) {
    const dotIdx = dotKey.indexOf(".");
    if (dotIdx === -1) continue;
    const sectionKey = dotKey.slice(0, dotIdx);
    const fieldKey = dotKey.slice(dotIdx + 1);
    const existing = await db.select().from(cmsContent).where(and(eq(cmsContent.pageSlug, pageSlug), eq(cmsContent.sectionKey, sectionKey), eq(cmsContent.fieldKey, fieldKey)));
    if (existing.length) {
      await db.update(cmsContent).set({ value, updatedAt: new Date() }).where(eq(cmsContent.id, existing[0].id));
    } else {
      await db.insert(cmsContent).values({ pageSlug, sectionKey, fieldKey, value });
    }
  }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — CMS PAGES
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/cms-pages", requireAdmin, async (req, res): Promise<void> => {
  const pages = await db.select().from(cmsPages).orderBy(cmsPages.createdAt);
  res.json(pages);
});

router.post("/admin/cms-pages", requireAdmin, async (req, res): Promise<void> => {
  const { title, slug, description, status, scheduledAt, seoTitle, seoDescription } = req.body;
  const [page] = await db.insert(cmsPages).values({ title, slug, description, status: status ?? "draft", scheduledAt: scheduledAt ? new Date(scheduledAt) : null, seoTitle, seoDescription, publishedAt: status === "published" ? new Date() : null }).returning();
  res.status(201).json(page);
});

router.patch("/admin/cms-pages/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, slug, description, status, scheduledAt, seoTitle, seoDescription, publishedAt } = req.body;
  const [page] = await db.update(cmsPages).set({ title, slug, description, status, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, seoTitle, seoDescription, publishedAt: publishedAt ? new Date(publishedAt) : null, updatedAt: new Date() }).where(eq(cmsPages.id, id)).returning();
  if (!page) { res.status(404).json({ error: "Not found" }); return; }
  res.json(page);
});

router.delete("/admin/cms-pages/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(cmsPages).where(eq(cmsPages.id, id));
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — BLOG
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/blog", requireAdmin, async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "");
  const status = String(req.query.status ?? "");
  let query = db.select().from(blogPosts).$dynamic();
  const conditions = [];
  if (q) conditions.push(ilike(blogPosts.title, `%${q}%`));
  if (status) conditions.push(eq(blogPosts.status, status));
  if (conditions.length) query = query.where(and(...conditions));
  const posts = await query.orderBy(desc(blogPosts.createdAt));
  res.json(posts);
});

router.get("/admin/blog/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  res.json(post);
});

router.post("/admin/blog", requireAdmin, async (req, res): Promise<void> => {
  const { title, slug, excerpt, content, featuredImage, status, publishedAt, scheduledAt, seoTitle, seoDescription, tags, category, author, readMinutes } = req.body;
  const [post] = await db.insert(blogPosts).values({ title, slug, excerpt, content, featuredImage, status: status ?? "draft", publishedAt: publishedAt ? new Date(publishedAt) : null, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, seoTitle, seoDescription, tags: tags ?? [], category, author, readMinutes: readMinutes ?? 5 }).returning();
  res.status(201).json(post);
});

router.patch("/admin/blog/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, slug, excerpt, content, featuredImage, status, publishedAt, scheduledAt, seoTitle, seoDescription, tags, category, author, readMinutes } = req.body;
  const [post] = await db.update(blogPosts).set({ title, slug, excerpt, content, featuredImage, status, publishedAt: publishedAt ? new Date(publishedAt) : null, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, seoTitle, seoDescription, tags, category, author, readMinutes, updatedAt: new Date() }).where(eq(blogPosts.id, id)).returning();
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  res.json(post);
});

router.delete("/admin/blog/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — TESTIMONIALS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/testimonials", requireAdmin, async (req, res): Promise<void> => {
  const items = await db.select().from(testimonials).orderBy(testimonials.sortOrder);
  res.json(items);
});

router.post("/admin/testimonials", requireAdmin, async (req, res): Promise<void> => {
  const { name, role, company, avatar, content, rating, isPublished, isVideo, videoUrl, sortOrder } = req.body;
  const [item] = await db.insert(testimonials).values({ name, role, company, avatar, content, rating: rating ?? 5, isPublished: isPublished ?? true, isVideo: isVideo ?? false, videoUrl, sortOrder: sortOrder ?? 0 }).returning();
  res.status(201).json(item);
});

router.patch("/admin/testimonials/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, role, company, avatar, content, rating, isPublished, isVideo, videoUrl, sortOrder } = req.body;
  const [item] = await db.update(testimonials).set({ name, role, company, avatar, content, rating, isPublished, isVideo, videoUrl, sortOrder, updatedAt: new Date() }).where(eq(testimonials.id, id)).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

router.delete("/admin/testimonials/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(testimonials).where(eq(testimonials.id, id));
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — SEO
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/seo/:pageSlug", requireAdmin, async (req, res): Promise<void> => {
  const pageSlug = String(req.params.pageSlug ?? "");
  const [setting] = await db.select().from(seoSettings).where(eq(seoSettings.pageSlug, pageSlug));
  res.json(setting ?? { pageSlug, metaTitle: null, metaDescription: null, keywords: null, ogTitle: null, ogDescription: null, ogImage: null, schemaMarkup: null });
});

router.put("/admin/seo/:pageSlug", requireAdmin, async (req, res): Promise<void> => {
  const pageSlug = String(req.params.pageSlug ?? "");
  const { metaTitle, metaDescription, keywords, ogTitle, ogDescription, ogImage, schemaMarkup } = req.body;
  const existing = await db.select().from(seoSettings).where(eq(seoSettings.pageSlug, pageSlug));
  let result;
  if (existing.length) {
    [result] = await db.update(seoSettings).set({ metaTitle, metaDescription, keywords, ogTitle, ogDescription, ogImage, schemaMarkup, updatedAt: new Date() }).where(eq(seoSettings.pageSlug, pageSlug)).returning();
  } else {
    [result] = await db.insert(seoSettings).values({ pageSlug, metaTitle, metaDescription, keywords, ogTitle, ogDescription, ogImage, schemaMarkup }).returning();
  }
  res.json(result);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/nav", requireAdmin, async (req, res): Promise<void> => {
  const items = await db.select().from(navItems).orderBy(navItems.sortOrder);
  res.json(items);
});

router.post("/admin/nav", requireAdmin, async (req, res): Promise<void> => {
  const { label, href, location, sortOrder, isActive, isCta, opensNewTab } = req.body;
  const [item] = await db.insert(navItems).values({ label, href, location: location ?? "header", sortOrder: sortOrder ?? 0, isActive: isActive ?? true, isCta: isCta ?? false, opensNewTab: opensNewTab ?? false }).returning();
  res.status(201).json(item);
});

router.patch("/admin/nav/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { label, href, location, sortOrder, isActive, isCta, opensNewTab } = req.body;
  const [item] = await db.update(navItems).set({ label, href, location, sortOrder, isActive, isCta, opensNewTab }).where(eq(navItems.id, id)).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

router.delete("/admin/nav/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(navItems).where(eq(navItems.id, id));
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — FORM SUBMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/forms", requireAdmin, async (req, res): Promise<void> => {
  const type = String(req.query.type ?? "");
  let query = db.select().from(formSubmissions).$dynamic();
  if (type) query = query.where(eq(formSubmissions.formType, type));
  const items = await query.orderBy(desc(formSubmissions.createdAt));
  res.json(items);
});

router.patch("/admin/forms/:id/read", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [item] = await db.update(formSubmissions).set({ isRead: true }).where(eq(formSubmissions.id, id)).returning();
  res.json(item);
});

router.delete("/admin/forms/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(formSubmissions).where(eq(formSubmissions.id, id));
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — MEDIA
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/media", requireAdmin, async (req, res): Promise<void> => {
  const folder = String(req.query.folder ?? "");
  const q = String(req.query.q ?? "");
  let query = db.select().from(mediaFiles).$dynamic();
  const conds = [];
  if (folder) conds.push(eq(mediaFiles.folder, folder));
  if (q) conds.push(ilike(mediaFiles.filename, `%${q}%`));
  if (conds.length) query = query.where(and(...conds));
  const files = await query.orderBy(desc(mediaFiles.createdAt));
  res.json(files);
});

router.post("/admin/media", requireAdmin, async (req, res): Promise<void> => {
  const { filename, url, mimeType, size, folder, alt } = req.body;
  const [file] = await db.insert(mediaFiles).values({ filename, url, mimeType, size, folder: folder ?? "general", alt }).returning();
  res.status(201).json(file);
});

router.delete("/admin/media/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
  res.sendStatus(204);
});

// ─── Team members for a customer workspace ─────────────────────────────────
router.get("/admin/customers/:userId/team", requireAdmin, async (req, res): Promise<void> => {
  const ownerId = String(req.params.userId ?? "");
  if (!ownerId) { res.status(400).json({ error: "Missing userId" }); return; }

  const members = await db.select().from(teamMembersTable)
    .where(eq(teamMembersTable.ownerUserId, ownerId))
    .orderBy(desc(teamMembersTable.invitedAt));

  // Augment active members with audit stats
  const memberStats = await Promise.all(members.filter((m) => m.memberUserId).map(async (m) => {
    const [stats] = await db.select({ total: count() }).from(auditsTable).where(eq(auditsTable.userId, m.memberUserId!));
    const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, m.memberUserId!));
    return { memberId: m.id, auditCount: Number(stats?.total ?? 0), credits: credits ?? null };
  }));

  res.json({ members, memberStats });
});

export default router;
