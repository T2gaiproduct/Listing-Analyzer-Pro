import crypto from "crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db, plansTable, creditsTable, creditTransactionsTable, paymentsTable, couponsTable,
  userProfilesTable, subscriptionsTable,
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

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = crypto.randomBytes(16);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

// ─── Public ──────────────────────────────────────────────────────────────────

router.get("/plans", async (_req, res): Promise<void> => {
  const plans = await db.select().from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(plansTable.sortOrder);
  res.json(plans);
});

// ─── Authenticated ────────────────────────────────────────────────────────────

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  const subRows = await db.select({
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
    planName: plansTable.name,
    planDescription: plansTable.description,
    priceMonthly: plansTable.priceMonthly,
    priceYearly: plansTable.priceYearly,
    planAiCredits: plansTable.aiCredits,
    planImageCredits: plansTable.imageCredits,
    planAuditCredits: plansTable.auditCredits,
  }).from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));
  const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  const transactions = await db.select().from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, userId))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(50);
  const billingHistory = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.userId, userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(20);
  res.json({
    profile: profile ?? null,
    subscription: subRows[0] ?? null,
    credits: credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 },
    transactions,
    billingHistory,
  });
});

router.post("/auth/reset-password", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const newPassword = generatePassword();
  const result = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword, skip_password_checks: true }),
  }).then((r) => r.json()) as Record<string, any>;
  if (result?.errors) {
    res.status(400).json({ error: result.errors?.[0]?.message ?? "Failed to reset password" });
    return;
  }
  res.json({ newPassword });
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { fullName, companyName, phone, country, gstNumber, websiteUrl, teamSize } = req.body as Record<string, string | number>;
  const existing = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  let profile;
  if (existing.length) {
    [profile] = await db.update(userProfilesTable)
      .set({ fullName: fullName as string, companyName: companyName as string, phone: phone as string, country: country as string, gstNumber: gstNumber as string, websiteUrl: websiteUrl as string, teamSize: teamSize ? Number(teamSize) : undefined, updatedAt: new Date() })
      .where(eq(userProfilesTable.userId, userId)).returning();
  } else {
    [profile] = await db.insert(userProfilesTable)
      .values({ userId, fullName: fullName as string, companyName: companyName as string, phone: phone as string, country: country as string, gstNumber: gstNumber as string, websiteUrl: websiteUrl as string, teamSize: teamSize ? Number(teamSize) : undefined }).returning();
  }
  res.json(profile);
});

router.get("/credits", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const [credits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  const transactions = await db.select().from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, userId))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(50);
  res.json({ credits: credits ?? { aiCredits: 0, imageCredits: 0, auditCredits: 0 }, transactions });
});

router.get("/subscription", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db.select({
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
    planName: plansTable.name,
    priceMonthly: plansTable.priceMonthly,
    priceYearly: plansTable.priceYearly,
    planAiCredits: plansTable.aiCredits,
    planImageCredits: plansTable.imageCredits,
    planAuditCredits: plansTable.auditCredits,
  }).from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));
  res.json(rows[0] ?? null);
});

router.post("/subscription/cancel", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (!sub) { res.status(404).json({ error: "No active subscription" }); return; }
  await db.update(subscriptionsTable)
    .set({ status: "cancelled", autoRenew: false, updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, userId));
  res.json({ ok: true });
});

router.post("/subscription/upgrade", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { planId, billingCycle } = req.body as { planId: number; billingCycle: "monthly" | "yearly" };
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan) { res.status(400).json({ error: "Invalid plan" }); return; }
  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (sub) {
    await db.update(subscriptionsTable)
      .set({ planId: plan.id, billingCycle, status: "active", trialEndsAt: null, currentPeriodStart: now, currentPeriodEnd: periodEnd, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, userId));
  } else {
    await db.insert(subscriptionsTable).values({ userId, planId: plan.id, billingCycle, status: "active", currentPeriodStart: now, currentPeriodEnd: periodEnd });
  }
  await db.update(creditsTable)
    .set({ aiCredits: plan.aiCredits, imageCredits: plan.imageCredits, auditCredits: plan.auditCredits, updatedAt: now })
    .where(eq(creditsTable.userId, userId));
  await db.insert(creditTransactionsTable).values([
    { userId, creditType: "ai", amount: plan.aiCredits, reason: `Upgraded to ${plan.name}`, featureType: "subscription" },
    { userId, creditType: "image", amount: plan.imageCredits, reason: `Upgraded to ${plan.name}`, featureType: "subscription" },
    { userId, creditType: "audit", amount: plan.auditCredits, reason: `Upgraded to ${plan.name}`, featureType: "subscription" },
  ]);
  res.json({ ok: true });
});

router.patch("/subscription/auto-renew", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { autoRenew } = req.body as { autoRenew: boolean };
  await db.update(subscriptionsTable).set({ autoRenew, updatedAt: new Date() }).where(eq(subscriptionsTable.userId, userId));
  res.json({ ok: true });
});

router.get("/billing-history", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const payments = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.userId, userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(20);
  res.json(payments);
});

router.post("/coupon/validate", requireAuth, async (req, res): Promise<void> => {
  const { code } = req.body as { code: string };
  if (!code) { res.status(400).json({ error: "No coupon code provided" }); return; }
  const [coupon] = await db.select().from(couponsTable)
    .where(and(eq(couponsTable.code, code.toUpperCase()), eq(couponsTable.isActive, true)));
  if (!coupon) { res.status(404).json({ error: "Coupon not found or expired" }); return; }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    res.status(400).json({ error: "Coupon has reached its usage limit" }); return;
  }
  if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
    res.status(400).json({ error: "Coupon has expired" }); return;
  }
  res.json({
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    discountAmount: coupon.discountAmount,
    description: coupon.description ?? (coupon.discountPercent ? `${coupon.discountPercent}% off` : `$${coupon.discountAmount} off`),
  });
});

router.post("/onboarding", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { fullName, companyName, phone, country, gstNumber, websiteUrl, teamSize, planId, billingCycle, useTrial, cardNumber, autoRenew, couponCode } = req.body as {
    fullName: string; companyName: string; phone: string; country: string;
    gstNumber?: string; websiteUrl?: string; teamSize?: number;
    planId: number; billingCycle: "monthly" | "yearly"; useTrial: boolean;
    cardNumber?: string; autoRenew?: boolean; couponCode?: string;
  };

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan) { res.status(400).json({ error: "Invalid plan" }); return; }

  const existingProfile = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (existingProfile.length) {
    await db.update(userProfilesTable)
      .set({ fullName, companyName, phone, country, gstNumber: gstNumber ?? null, websiteUrl: websiteUrl ?? null, teamSize: teamSize ?? null, onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(userProfilesTable.userId, userId));
  } else {
    await db.insert(userProfilesTable).values({ userId, fullName, companyName, phone, country, gstNumber: gstNumber ?? null, websiteUrl: websiteUrl ?? null, teamSize: teamSize ?? null, onboardingCompleted: true });
  }

  let discountAmount = 0;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable)
      .where(and(eq(couponsTable.code, couponCode.toUpperCase()), eq(couponsTable.isActive, true)));
    if (coupon) {
      const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
      if (coupon.discountPercent) discountAmount = Math.round(price * coupon.discountPercent / 100);
      else if (coupon.discountAmount) discountAmount = coupon.discountAmount;
      await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
    }
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + (plan.trialDays || 7));

  const cardLast4 = (!useTrial && cardNumber) ? cardNumber.replace(/\s/g, "").slice(-4) : null;
  const cardBrand = (!useTrial && cardNumber) ? detectBrand(cardNumber.replace(/\s/g, "")) : null;

  const existingSub = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  const subData = {
    planId: plan.id,
    billingCycle,
    status: useTrial ? "trial" : "active",
    trialEndsAt: useTrial ? trialEnd : null,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    cardLast4,
    cardBrand,
    autoRenew: autoRenew ?? true,
    couponCode: couponCode ?? null,
    discountAmount,
  };

  if (existingSub.length) {
    await db.update(subscriptionsTable).set({ ...subData, updatedAt: new Date() }).where(eq(subscriptionsTable.userId, userId));
  } else {
    await db.insert(subscriptionsTable).values({ userId, ...subData });
  }

  const existingCredits = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  if (existingCredits.length) {
    await db.update(creditsTable)
      .set({ aiCredits: plan.aiCredits, imageCredits: plan.imageCredits, auditCredits: plan.auditCredits, updatedAt: new Date() })
      .where(eq(creditsTable.userId, userId));
  } else {
    await db.insert(creditsTable).values({ userId, aiCredits: plan.aiCredits, imageCredits: plan.imageCredits, auditCredits: plan.auditCredits });
  }

  await db.insert(creditTransactionsTable).values([
    { userId, creditType: "ai", amount: plan.aiCredits, reason: `${plan.name} plan — onboarding`, featureType: "subscription" },
    { userId, creditType: "image", amount: plan.imageCredits, reason: `${plan.name} plan — onboarding`, featureType: "subscription" },
    { userId, creditType: "audit", amount: plan.auditCredits, reason: `${plan.name} plan — onboarding`, featureType: "subscription" },
  ]);

  if (!useTrial) {
    const basePrice = billingCycle === "yearly" ? plan.priceYearly * 12 : plan.priceMonthly;
    await db.insert(paymentsTable).values({
      userId,
      planId: plan.id,
      amount: Math.max(0, basePrice - discountAmount),
      status: "completed",
      gateway: "card",
      gatewayPaymentId: `sim_${Date.now()}`,
    });
  }

  res.json({ ok: true });
});

function detectBrand(num: string): string {
  if (/^4/.test(num)) return "Visa";
  if (/^5[1-5]/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "Amex";
  if (/^6(?:011|5)/.test(num)) return "Discover";
  return "Card";
}

export default router;
