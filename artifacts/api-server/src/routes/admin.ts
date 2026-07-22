import crypto from "crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, count, avg, sql, desc, and, inArray, gte, isNull } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db, auditsTable, competitorsTable, plansTable, creditsTable, creditTransactionsTable, creditPacksTable, creditRulesTable,
  paymentsTable, invoicesTable, refundsTable, couponsTable,
  adminRolesTable, adminUsersTable, adminInvitesTable, auditLogsTable, downloadsTable,
  settingsTable, notificationsTable,
  cmsContent, blogPosts, testimonials, faqs, seoSettings, navItems, formSubmissions, mediaFiles, cmsPages,
  userProfilesTable, subscriptionsTable, teamMembersTable, memberCreditsTable,
  graphicsProjectsTable,
} from "@workspace/db";
import OpenAI from "openai";
import { like, or, ilike } from "drizzle-orm";
import { clearProviderCache } from "../lib/ai-provider";
import { clearOpenAICache } from "../lib/openai-client";
import { clearGeminiCache } from "../lib/gemini-client";
import { normalizeBrandingSettingValue } from "../lib/branding-storage";
import { ANNOUNCEMENT_PROMO_CATEGORY, ANNOUNCEMENT_PROMO_KEYS } from "../lib/announcement-promo.js";
import { ensurePromoCoupon } from "../lib/promo-coupon-sync.js";
import { saveHeroImageFromDataUrl } from "../lib/hero-image-storage";
import { savePortfolioImageFromDataUrl } from "../lib/portfolio-image-storage";
import { saveWorkflowImageFromDataUrl } from "../lib/workflow-image-storage";
import {
  isAdminUser,
  requireAdmin,
  requireAdminWithPermission,
  type AdminRequest,
} from "../lib/admin-auth";
import { ADMIN_PERMISSIONS } from "@workspace/admin-permissions";
import { getClerkUserEmailAndName, sendAdminRoleAssignedEmail, sendAdminRoleInviteEmail } from "../lib/admin-role-email.js";
import { normalizeAdminEmail, ensureAdminInviteToken } from "../lib/admin-invites.js";
import { buildAdminInviteUrl, generateAdminInviteToken } from "../lib/admin-invite-token.js";
import { computePlanPoolsFromAllocations, planRowToGrantCredits } from "../lib/plan-credits.js";

const router: IRouter = Router();

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? "";

function sanitizeRolePermissions(req: AdminRequest, permissions: unknown): string[] {
  const valid = new Set<string>(ADMIN_PERMISSIONS);
  const requested = Array.isArray(permissions) ? permissions.filter((p): p is string => typeof p === "string") : [];
  const filtered = requested.filter((p) => valid.has(p));
  if (req.admin.isSuperAdmin) return filtered;
  return filtered.filter((p) => req.admin.permissions.includes(p));
}

function resolveAppBaseUrl(req: Request): string | undefined {
  const origin = req.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const referer = req.get("referer");
  if (referer) {
    try { return new URL(referer).origin; } catch { /* ignore */ }
  }
  return undefined;
}

async function notifyAdminRoleAssignment(
  req: Request,
  opts: { userId: string; email?: string; roleId: number; isUpdate?: boolean },
): Promise<{ emailSent: boolean; emailError?: string }> {
  const adminReq = req as AdminRequest;
  let toEmail = opts.email?.trim().toLowerCase();
  let recipientName = toEmail ?? "there";

  const clerkProfile = await getClerkUserEmailAndName(opts.userId, clerkFetch);
  if (clerkProfile) {
    toEmail = clerkProfile.email;
    recipientName = clerkProfile.name;
  }

  if (!toEmail) return { emailSent: false, emailError: "Recipient email not found" };

  const assignerProfile = await getClerkUserEmailAndName(adminReq.admin.userId, clerkFetch);
  const assignedByName = assignerProfile?.name ?? "An administrator";

  try {
    const result = await sendAdminRoleAssignedEmail({
      toEmail,
      recipientName,
      roleId: opts.roleId,
      assignedByName,
      isUpdate: opts.isUpdate,
      appBaseUrl: resolveAppBaseUrl(req),
    });
    if (!result.success) {
      req.log?.warn?.({ emailError: result.error, toEmail }, "Failed to send admin role assignment email");
      return { emailSent: false, emailError: result.error };
    }
    return { emailSent: true };
  } catch (emailErr) {
    req.log?.warn?.({ emailErr, toEmail }, "Failed to send admin role assignment email");
    return { emailSent: false, emailError: emailErr instanceof Error ? emailErr.message : "Email send failed" };
  }
}

/** All /admin/* routes (except public checks) require admin + route permission. */
router.use((req, res, next) => {
  // Public invite lookup lives in public.ts at /admin-role-invite/:token (must not match /admin guard).
  if (req.path.startsWith("/admin-role-invite")) return next();
  if (!req.path.startsWith("/admin")) return next();
  if (req.path === "/admin/is-admin" || req.path === "/admin/me") return next();
  return requireAdminWithPermission(req, res, next);
});

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = crypto.randomBytes(16);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

// Public (auth-only) endpoint to check admin status — used by frontend AdminRoute
router.get("/admin/is-admin", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.json({ isAdmin: false }); return; }
  const email = auth?.sessionClaims?.email as string | undefined;
  const ok = await isAdminUser(userId, email);
  res.json({ isAdmin: ok });
});

router.get("/admin/me", requireAdmin, async (req, res): Promise<void> => {
  const ctx = (req as AdminRequest).admin;
  res.json({
    isSuperAdmin: ctx.isSuperAdmin,
    role: ctx.role ? { id: ctx.role.id, name: ctx.role.name } : null,
    permissions: ctx.permissions,
  });
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

type ClerkUserRecord = Record<string, unknown>;

/** Clerk BAPI may return a raw user array or a paginated `{ data: [] }` object. */
function parseClerkUserList(raw: unknown): ClerkUserRecord[] {
  if (Array.isArray(raw)) return raw as ClerkUserRecord[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: ClerkUserRecord[] }).data;
  }
  return [];
}

/** Total users matching optional Clerk filters (milliseconds since epoch). */
async function clerkUserCount(params?: Record<string, number | string>): Promise<number> {
  const qs = params
    ? `?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString()}`
    : "";
  const result = await clerkFetch(`/users/count${qs}`) as { total_count?: number };
  return typeof result?.total_count === "number" ? result.total_count : 0;
}

async function countProfilesSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(userProfilesTable)
    .where(gte(userProfilesTable.createdAt, since));
  return Number(row?.c ?? 0);
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

  const todayStart = new Date(todayStartMs);
  const sevenDaysAgo = new Date(sevenDaysAgoMs);
  const thirtyDaysAgo = new Date(thirtyDaysAgoMs);

  const [
    recentSignupsRaw,
    recentLoginsRaw,
    clerkTotalUsers,
    clerkNewToday,
    clerkNewWeek,
    clerkNewMonth,
    dbTotalUsers,
    dbNewToday,
    dbNewWeek,
    dbNewMonth,
  ] = await Promise.all([
    clerkFetch(`/users?limit=10&order_by=-created_at`),
    clerkFetch(`/users?limit=10&order_by=-last_sign_in_at`),
    clerkUserCount(),
    clerkUserCount({ created_at_after: todayStartMs }),
    clerkUserCount({ created_at_after: sevenDaysAgoMs }),
    clerkUserCount({ created_at_after: thirtyDaysAgoMs }),
    db.select({ c: count() }).from(userProfilesTable),
    countProfilesSince(todayStart),
    countProfilesSince(sevenDaysAgo),
    countProfilesSince(thirtyDaysAgo),
  ]);

  const totalUsers = Math.max(clerkTotalUsers, Number(dbTotalUsers[0]?.c ?? 0));
  const newUsersToday = Math.max(clerkNewToday, dbNewToday);
  const newUsersThisWeek = Math.max(clerkNewWeek, dbNewWeek);
  const newUsersThisMonth = Math.max(clerkNewMonth, dbNewMonth);

  function mapClerkUser(u: ClerkUserRecord) {
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

  const recentSignups = parseClerkUserList(recentSignupsRaw).map(mapClerkUser);
  const recentLogins = parseClerkUserList(recentLoginsRaw)
    .filter((u) => u.last_sign_in_at)
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
    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,
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
    db.select({
      id: subscriptionsTable.id,
      userId: subscriptionsTable.userId,
      planId: subscriptionsTable.planId,
      billingCycle: subscriptionsTable.billingCycle,
      status: subscriptionsTable.status,
      trialEndsAt: subscriptionsTable.trialEndsAt,
      currentPeriodStart: subscriptionsTable.currentPeriodStart,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      cardLast4: subscriptionsTable.cardLast4,
      cardBrand: subscriptionsTable.cardBrand,
      autoRenew: subscriptionsTable.autoRenew,
      couponCode: subscriptionsTable.couponCode,
      discountAmount: subscriptionsTable.discountAmount,
      stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
      stripeCheckoutSessionId: subscriptionsTable.stripeCheckoutSessionId,
      createdAt: subscriptionsTable.createdAt,
      planName: plansTable.name,
      planDescription: plansTable.description,
      priceMonthly: plansTable.priceMonthly,
      priceYearly: plansTable.priceYearly,
      planAiCredits: plansTable.aiCredits,
      planImageCredits: plansTable.imageCredits,
      planAuditCredits: plansTable.auditCredits,
      creditAllocations: plansTable.creditAllocations,
    }).from(subscriptionsTable).leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id)).where(eq(subscriptionsTable.userId, userId)),
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
  await db.update(auditsTable).set({ isDeleted: 1, deletedAt: new Date() }).where(eq(auditsTable.userId, userId));
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
    const grantCredits = await planRowToGrantCredits(plan);
    const [existing] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
    if (existing) {
      await db.update(creditsTable)
        .set({ aiCredits: existing.aiCredits + grantCredits.aiCredits, imageCredits: existing.imageCredits + grantCredits.imageCredits, auditCredits: existing.auditCredits + grantCredits.auditCredits, updatedAt: now })
        .where(eq(creditsTable.userId, userId));
    } else {
      await db.insert(creditsTable).values({ userId, aiCredits: grantCredits.aiCredits, imageCredits: grantCredits.imageCredits, auditCredits: grantCredits.auditCredits });
    }
    await db.insert(creditTransactionsTable).values([
      { userId, creditType: "ai", amount: grantCredits.aiCredits, reason: `Admin: package changed to ${plan.name}`, featureType: "subscription" },
      { userId, creditType: "image", amount: grantCredits.imageCredits, reason: `Admin: package changed to ${plan.name}`, featureType: "subscription" },
      { userId, creditType: "audit", amount: grantCredits.auditCredits, reason: `Admin: package changed to ${plan.name}`, featureType: "subscription" },
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
  await db.update(competitorsTable).set({ isDeleted: 1, deletedAt: new Date() }).where(eq(competitorsTable.auditId, id));
  await db.update(auditsTable).set({ isDeleted: 1, deletedAt: new Date() }).where(eq(auditsTable.id, id));
  res.sendStatus(204);
});

// ─── Admin Graphics Logs ──────────────────────────────────────────────────────
router.get("/admin/graphics-logs", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const projects = await db
    .select()
    .from(graphicsProjectsTable)
    .orderBy(desc(graphicsProjectsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db.select({ c: count() }).from(graphicsProjectsTable);

  res.json({ projects, total: Number(total?.c ?? 0) });
});

router.delete("/admin/graphics-logs/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(graphicsProjectsTable).set({ isDeleted: 1, deletedAt: new Date() }).where(eq(graphicsProjectsTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/plans", requireAdmin, async (req, res): Promise<void> => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.priceMonthly);
  res.json(plans);
});

router.post("/admin/plans", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, priceMonthly, priceYearly, creditAllocations, teamMembers, features, excludedFeatures, isTrial, trialDays, tag, sortOrder, isHighlighted, ctaText } = req.body;
  const allocations = creditAllocations ?? {};
  const pools = await computePlanPoolsFromAllocations(allocations);
  const [plan] = await db
    .insert(plansTable)
    .values({
      name, description, priceMonthly, priceYearly,
      aiCredits: pools.aiCredits,
      imageCredits: pools.imageCredits,
      auditCredits: pools.auditCredits,
      teamMembers: teamMembers ?? 1,
      creditAllocations: allocations,
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
  const { name, description, priceMonthly, priceYearly, creditAllocations, teamMembers, features, excludedFeatures, isActive, isTrial, trialDays, tag, sortOrder, isHighlighted, ctaText } = req.body;
  const setObj: Record<string, unknown> = { name, description, priceMonthly, priceYearly, teamMembers, features, excludedFeatures, isActive, isTrial, trialDays, tag, sortOrder, isHighlighted, ctaText, updatedAt: new Date() };
  if (creditAllocations !== undefined) {
    setObj.creditAllocations = creditAllocations;
    const pools = await computePlanPoolsFromAllocations(creditAllocations);
    setObj.aiCredits = pools.aiCredits;
    setObj.imageCredits = pools.imageCredits;
    setObj.auditCredits = pools.auditCredits;
  }
  const [plan] = await db
    .update(plansTable)
    .set(setObj)
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

router.get("/admin/subscriptions", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: subscriptionsTable.id,
      userId: subscriptionsTable.userId,
      planId: subscriptionsTable.planId,
      planName: plansTable.name,
      billingCycle: subscriptionsTable.billingCycle,
      status: subscriptionsTable.status,
      priceMonthly: plansTable.priceMonthly,
      priceYearly: plansTable.priceYearly,
      discountAmount: subscriptionsTable.discountAmount,
      trialEndsAt: subscriptionsTable.trialEndsAt,
      currentPeriodStart: subscriptionsTable.currentPeriodStart,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
      autoRenew: subscriptionsTable.autoRenew,
      createdAt: subscriptionsTable.createdAt,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .orderBy(desc(subscriptionsTable.createdAt));
  res.json({ subscriptions: rows, total: rows.length });
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
  let paymentId = parseInt(String(req.params.paymentId ?? ""), 10);
  if (isNaN(paymentId)) { res.status(400).json({ error: "Invalid payment ID" }); return; }
  // If no direct payment found, try resolving via invoiceId on paymentsTable
  let [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment) {
    const linked = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, paymentId)).limit(1);
    if (linked.length > 0) {
      payment = linked[0];
      paymentId = payment.id;
    }
  }
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
  const normalizedCode = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!normalizedCode) {
    res.status(400).json({ error: "Coupon code is required" });
    return;
  }
  const percent = discountPercent != null && discountPercent !== "" ? Number(discountPercent) : null;
  const amount = discountAmount != null && discountAmount !== "" ? Number(discountAmount) : null;
  if ((percent == null || Number.isNaN(percent)) && (amount == null || Number.isNaN(amount))) {
    res.status(400).json({ error: "Set either a discount percent or a fixed discount amount" });
    return;
  }
  const [c] = await db.insert(couponsTable).values({
    code: normalizedCode,
    description,
    discountPercent: percent,
    discountAmount: amount,
    maxUses: maxUses != null && maxUses !== "" ? Number(maxUses) : 1,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    appliesTo,
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
  const [role] = await db.insert(adminRolesTable).values({
    name,
    description,
    permissions: sanitizeRolePermissions(req as AdminRequest, permissions ?? []),
  }).returning();
  res.status(201).json(role);
});

router.patch("/admin/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, description, permissions } = req.body;
  const [role] = await db.update(adminRolesTable).set({
    name,
    description,
    permissions: sanitizeRolePermissions(req as AdminRequest, permissions),
  }).where(eq(adminRolesTable.id, id)).returning();
  res.json(role);
});

router.delete("/admin/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(adminRolesTable).where(eq(adminRolesTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/admin-users", requireAdmin, async (req, res): Promise<void> => {
  try {
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

  const invites = await db.select().from(adminInvitesTable).where(isNull(adminInvitesTable.acceptedAt));

  res.json({
    users: enriched,
    invites: await Promise.all(invites.map(async (invite) => {
      const token = invite.inviteToken ?? await ensureAdminInviteToken(invite.id);
      return {
        ...invite,
        inviteToken: token,
        role: roleMap[invite.roleId] ?? null,
        status: "pending" as const,
      };
    })),
  });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to list admin role assignments");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load role assignments" });
  }
});

router.post("/admin/admin-users", requireAdmin, async (req, res): Promise<void> => {
  try {
  const { email, roleId } = req.body as { email?: string; roleId: number; userId?: string };
  let targetUserId = req.body.userId as string | undefined;
  const adminReq = req as AdminRequest;

  if (!email?.trim() && !targetUserId) {
    res.status(400).json({ error: "Provide email or userId" });
    return;
  }

  // If email provided, look up in Clerk
  if (!targetUserId && email) {
    const normalizedEmail = normalizeAdminEmail(email);
    const result = await clerkFetch(`/users?email_address=${encodeURIComponent(normalizedEmail)}&limit=1`) as Record<string, unknown> | unknown[];
    const usersList = Array.isArray(result) ? result : ((result as Record<string, unknown>).data as unknown[] ?? []);

    if (!usersList.length) {
      const [existingInvite] = await db.select().from(adminInvitesTable)
        .where(eq(adminInvitesTable.email, normalizedEmail)).limit(1);
      const inviteToken = existingInvite?.inviteToken ?? generateAdminInviteToken();

      const [invite] = await db.insert(adminInvitesTable).values({
        email: normalizedEmail,
        roleId,
        inviteToken,
        invitedByUserId: adminReq.admin.userId,
      }).onConflictDoUpdate({
        target: adminInvitesTable.email,
        set: {
          roleId,
          invitedByUserId: adminReq.admin.userId,
          acceptedAt: null,
          acceptedUserId: null,
          inviteToken,
        },
      }).returning();

      const inviteUrl = buildAdminInviteUrl(invite.inviteToken ?? inviteToken, resolveAppBaseUrl(req));
      const assignerProfile = await getClerkUserEmailAndName(adminReq.admin.userId, clerkFetch);
      const assignedByName = assignerProfile?.name ?? "An administrator";
      const emailResult = await sendAdminRoleInviteEmail({
        toEmail: normalizedEmail,
        roleId,
        assignedByName,
        appBaseUrl: resolveAppBaseUrl(req),
        inviteUrl,
      });

      res.status(201).json({ pending: true, invite, inviteUrl, ...emailResult });
      return;
    }

    targetUserId = (usersList[0] as Record<string, unknown>).id as string;
    await db.delete(adminInvitesTable).where(eq(adminInvitesTable.email, normalizedEmail));
  }

  if (!targetUserId) { res.status(400).json({ error: "Provide email or userId" }); return; }

  const [existingAssignment] = await db.select({ id: adminUsersTable.id })
    .from(adminUsersTable).where(eq(adminUsersTable.userId, targetUserId)).limit(1);

  const [u] = await db.insert(adminUsersTable).values({ userId: targetUserId, roleId })
    .onConflictDoUpdate({ target: adminUsersTable.userId, set: { roleId } })
    .returning();

  const emailResult = await notifyAdminRoleAssignment(req, {
    userId: targetUserId,
    email,
    roleId,
    isUpdate: !!existingAssignment,
  });

  res.status(201).json({ ...u, ...emailResult });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to assign admin role");
    const message = err instanceof Error ? err.message : "Failed to assign role";
    if (message.includes("admin_invites") && message.includes("does not exist")) {
      res.status(503).json({ error: "Database is missing admin_invites table. Run pnpm --filter @workspace/db run push." });
      return;
    }
    res.status(500).json({ error: message });
  }
});

router.delete("/admin/admin-invites/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(adminInvitesTable).where(eq(adminInvitesTable.id, id));
  res.sendStatus(204);
});

router.patch("/admin/admin-users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { roleId } = req.body;
  const [u] = await db.update(adminUsersTable).set({ roleId }).where(eq(adminUsersTable.id, id)).returning();
  if (!u) { res.status(404).json({ error: "Assignment not found" }); return; }

  const emailResult = await notifyAdminRoleAssignment(req, {
    userId: u.userId,
    roleId,
    isUpdate: true,
  });

  res.json({ ...u, ...emailResult });
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
  const { userId, type, title, message, link } = req.body;
  const [n] = await db.insert(notificationsTable).values({ userId: userId ?? null, type, title, message, link }).returning();
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
    "openai_api_key",
    "gemini_api_key",
    "resend_api_key",
    "smtp_password",
  ]);

  // Enforce mutual exclusivity for payment gateway enabled flags
  if (category === "payment_gateway") {
    const s = settings as Record<string, string>;
    const stripeEnabled = s.stripe_enabled === "true";
    const razorpayEnabled = s.razorpay_enabled === "true";
    const paypalEnabled = s.paypal_enabled === "true";
    const count = [stripeEnabled, razorpayEnabled, paypalEnabled].filter(Boolean).length;
    if (count > 1) {
      res.status(400).json({ error: "Only one payment gateway can be enabled at a time." });
      return;
    }
  }

  if (category === "platform") {
    const s = settings as Record<string, string>;
    try {
      if ("site_logo_url" in s) {
        s.site_logo_url = normalizeBrandingSettingValue("site_logo_url", s.site_logo_url);
      }
      if ("site_favicon_url" in s) {
        s.site_favicon_url = normalizeBrandingSettingValue("site_favicon_url", s.site_favicon_url);
      }
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid branding image" });
      return;
    }
  }

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

  // Clear AI provider caches when AI settings change
  clearProviderCache();
  clearOpenAICache();
  clearGeminiCache();

  if (category === ANNOUNCEMENT_PROMO_CATEGORY) {
    const promoSettings = settings as Record<string, string>;
    const promoCode = promoSettings[ANNOUNCEMENT_PROMO_KEYS.code]?.trim();
    if (promoCode) {
      await ensurePromoCoupon(promoCode, 20);
    }
  }

  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/admin/test-openai-key", requireAdmin, async (req, res): Promise<void> => {
  const { key } = req.body as { key?: string };
  if (!key?.trim()) { res.status(400).json({ valid: false, error: "Key is required" }); return; }
  try {
    const client = new OpenAI({ apiKey: key, baseURL: "https://api.openai.com/v1" });
    await client.models.list();
    res.json({ valid: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid key";
    res.json({ valid: false, error: message });
  }
});

import { GoogleGenAI } from "@google/genai";
import { getReplitClient } from "../lib/replit-client";

router.post("/admin/test-gemini-key", requireAdmin, async (req, res): Promise<void> => {
  const { key } = req.body as { key?: string };
  if (!key?.trim()) { res.status(400).json({ valid: false, error: "Key is required" }); return; }
  try {
    const client = new GoogleGenAI({ apiKey: key });
    const pager = await client.models.list();
    if (pager.page && pager.page.length > 0) {
      res.json({ valid: true });
    } else {
      res.json({ valid: false, error: "No models available. Check your API key permissions." });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid key";
    res.json({ valid: false, error: message });
  }
});

router.post("/admin/test-replit-ai", requireAdmin, async (req, res): Promise<void> => {
  try {
    const client = getReplitClient();
    const response = await client.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 16,
      messages: [{ role: "user", content: "Say hello" }],
    });
    const ok = response.choices?.[0]?.message?.content !== undefined;
    res.json({ valid: ok });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    res.json({ valid: false, error: message });
  }
});

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

// ─── FAQs ──────────────────────────────────────────────────────────────────
router.get("/admin/faqs", requireAdmin, async (_req, res): Promise<void> => {
  const items = await db.select().from(faqs).orderBy(faqs.sortOrder);
  res.json(items);
});

router.post("/admin/faqs", requireAdmin, async (req, res): Promise<void> => {
  const { question, answer, category, isPublished, sortOrder } = req.body as Record<string, unknown>;
  if (!question || !answer) { res.status(400).json({ error: "question and answer are required" }); return; }
  const [item] = await db.insert(faqs).values({
    question: String(question),
    answer: String(answer),
    category: (category as string) ?? null,
    isPublished: isPublished === undefined ? true : Boolean(isPublished),
    sortOrder: sortOrder != null ? Number(sortOrder) : 0,
  }).returning();
  res.status(201).json(item);
});

router.patch("/admin/faqs/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { question, answer, category, isPublished, sortOrder } = req.body as Record<string, unknown>;
  const [item] = await db.update(faqs).set({
    question: question as string,
    answer: answer as string,
    category: category as string,
    isPublished: isPublished as boolean,
    sortOrder: sortOrder as number,
    updatedAt: new Date(),
  }).where(eq(faqs.id, id)).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

router.delete("/admin/faqs/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(faqs).where(eq(faqs.id, id));
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

router.post("/admin/hero-image", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { dataUrl, filename, folder } = req.body as { dataUrl?: string; filename?: string; folder?: string };
    if (!dataUrl) {
      res.status(400).json({ error: "No image data provided" });
      return;
    }
    const url = folder === "portfolio"
      ? savePortfolioImageFromDataUrl(dataUrl, filename)
      : folder === "workflow"
        ? saveWorkflowImageFromDataUrl(dataUrl, filename)
        : saveHeroImageFromDataUrl(dataUrl, filename);
    res.status(201).json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

router.post("/admin/portfolio-image", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { dataUrl, filename } = req.body as { dataUrl?: string; filename?: string };
    if (!dataUrl) {
      res.status(400).json({ error: "No image data provided" });
      return;
    }
    const url = savePortfolioImageFromDataUrl(dataUrl, filename);
    res.status(201).json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

router.post("/admin/workflow-image", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { dataUrl, filename } = req.body as { dataUrl?: string; filename?: string };
    if (!dataUrl) {
      res.status(400).json({ error: "No image data provided" });
      return;
    }
    const url = saveWorkflowImageFromDataUrl(dataUrl, filename);
    res.status(201).json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
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

// ─── Admin Credit Rules Management ────────────────────────────────────────────

router.get("/admin/credit-rules", requireAdmin, async (req, res): Promise<void> => {
  const rules = await db
    .select()
    .from(creditRulesTable)
    .orderBy(creditRulesTable.sortOrder);
  res.json(rules);
});

router.post("/admin/credit-rules", requireAdmin, async (req, res): Promise<void> => {
  const { activityName, featureType, creditType, creditsRequired, sortOrder, isActive } = req.body as {
    activityName: string;
    featureType: string;
    creditType?: string;
    creditsRequired?: number;
    sortOrder?: number;
    isActive?: boolean;
  };
  if (!activityName || !featureType) {
    res.status(400).json({ error: "activityName and featureType are required" });
    return;
  }
  const [rule] = await db
    .insert(creditRulesTable)
    .values({
      activityName,
      featureType,
      creditType: creditType ?? "audit",
      creditsRequired: creditsRequired ?? 1,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    })
    .returning();
  res.status(201).json(rule);
});

router.patch("/admin/credit-rules/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = req.body as Partial<{
    activityName: string;
    featureType: string;
    creditType: string;
    creditsRequired: number;
    sortOrder: number;
    isActive: boolean;
  }>;
  const now = new Date();
  const [updated] = await db
    .update(creditRulesTable)
    .set({ ...body, updatedAt: now })
    .where(eq(creditRulesTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Rule not found" }); return; }
  res.json(updated);
});

router.delete("/admin/credit-rules/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(creditRulesTable).where(eq(creditRulesTable.id, id));
  res.sendStatus(204);
});

// ─── Admin Credit Pack Management ─────────────────────────────────────────────

router.get("/admin/credit-packs", requireAdmin, async (req, res): Promise<void> => {
  const packs = await db
    .select()
    .from(creditPacksTable)
    .orderBy(creditPacksTable.sortOrder);
  res.json(packs);
});

router.post("/admin/credit-packs", requireAdmin, async (req, res): Promise<void> => {
  const { creditType, quantity, priceCents, label, sortOrder, isActive } = req.body as {
    creditType: string;
    quantity: number;
    priceCents: number;
    label?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  if (!creditType || !quantity || !priceCents) {
    res.status(400).json({ error: "creditType, quantity, and priceCents are required" });
    return;
  }
  const [pack] = await db
    .insert(creditPacksTable)
    .values({
      creditType,
      quantity,
      priceCents,
      label: label ?? null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    })
    .returning();
  res.status(201).json(pack);
});

router.patch("/admin/credit-packs/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = req.body as Partial<{
    creditType: string;
    quantity: number;
    priceCents: number;
    label: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  const now = new Date();
  const [updated] = await db
    .update(creditPacksTable)
    .set({ ...body, updatedAt: now })
    .where(eq(creditPacksTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Pack not found" }); return; }
  res.json(updated);
});

router.delete("/admin/credit-packs/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(creditPacksTable).where(eq(creditPacksTable.id, id));
  res.sendStatus(204);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Team Activity
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/admin/team-activity", requireAdmin, async (req, res): Promise<void> => {
  const teams = await db.select({
    id: teamMembersTable.id,
    ownerUserId: teamMembersTable.ownerUserId,
    memberUserId: teamMembersTable.memberUserId,
    invitedEmail: teamMembersTable.invitedEmail,
    invitedName: teamMembersTable.invitedName,
    role: teamMembersTable.role,
    status: teamMembersTable.status,
    invitedAt: teamMembersTable.invitedAt,
    acceptedAt: teamMembersTable.acceptedAt,
  }).from(teamMembersTable).orderBy(desc(teamMembersTable.invitedAt));

  // Get owner profiles for company names
  const ownerIds = [...new Set(teams.map((t) => t.ownerUserId))];
  const profiles = ownerIds.length > 0
    ? await db.select().from(userProfilesTable).where(inArray(userProfilesTable.userId, ownerIds))
    : [];

  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  // Get member credits
  const memberIds = teams.map((t) => t.id);
  const memberCredits = memberIds.length > 0
    ? await db.select().from(memberCreditsTable).where(inArray(memberCreditsTable.memberId, memberIds))
    : [];
  const creditsMap = new Map(memberCredits.map((c) => [c.memberId, c]));

  // Get owner audit counts
  const ownerAuditCounts: Record<string, number> = {};
  for (const ownerId of ownerIds) {
    const [countRow] = await db.select({ c: count() }).from(auditsTable).where(eq(auditsTable.userId, ownerId));
    ownerAuditCounts[ownerId] = Number(countRow?.c ?? 0);
  }

  const grouped = ownerIds.map((ownerId) => {
    const profile = profileMap.get(ownerId);
    const teamMembers = teams.filter((t) => t.ownerUserId === ownerId);
    const activeMembers = teamMembers.filter((t) => t.status === "active");
    const pendingMembers = teamMembers.filter((t) => t.status === "pending");
    const revokedMembers = teamMembers.filter((t) => t.status === "revoked");
    return {
      ownerUserId: ownerId,
      companyName: profile?.companyName ?? null,
      ownerEmail: null,
      ownerAuditCount: ownerAuditCounts[ownerId] ?? 0,
      totalMembers: teamMembers.length,
      activeCount: activeMembers.length,
      pendingCount: pendingMembers.length,
      revokedCount: revokedMembers.length,
      members: teamMembers.map((m) => ({
        ...m,
        allocatedCredits: creditsMap.get(m.id) ?? null,
      })),
    };
  });

  res.json({
    totalTeams: grouped.length,
    totalMembers: teams.length,
    activeMembers: teams.filter((t) => t.status === "active").length,
    pendingInvites: teams.filter((t) => t.status === "pending").length,
    teams: grouped,
  });
});

export default router;
