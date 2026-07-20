import crypto from "crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db, plansTable, creditsTable, creditTransactionsTable, creditPacksTable, creditRulesTable, paymentsTable, invoicesTable, couponsTable,
  userProfilesTable, subscriptionsTable, notificationsTable, settingsTable, faqs, formSubmissions,
  teamMembersTable,
} from "@workspace/db";
import { fulfillStripeCreditCheckout } from "../lib/stripe-credit-checkout";
import { isRefundedDebit, refundedDebitIds, type CreditUsageTx } from "../lib/credit-usage-net";
import { ensureSubscriptionCredits } from "../lib/subscription-credits";
import { upsertUserProfile } from "../lib/user-profile";
import { getGatewaySettings } from "./payment";
import { isDataUrl, normalizeBrandingSettingValue } from "../lib/branding-storage";

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

router.get("/faqs", async (_req, res): Promise<void> => {
  const items = await db.select().from(faqs)
    .where(eq(faqs.isPublished, true))
    .orderBy(faqs.sortOrder);
  res.json(items);
});

const BRANDING_KEYS = ["platform_name", "site_logo_url", "site_favicon_url"] as const;

router.get("/branding", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...BRANDING_KEYS]));

  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  let logoUrl = map.site_logo_url?.trim() || null;
  let faviconUrl = map.site_favicon_url?.trim() || null;

  if (logoUrl && isDataUrl(logoUrl)) {
    const stored = normalizeBrandingSettingValue("site_logo_url", logoUrl);
    await db
      .update(settingsTable)
      .set({ value: stored, updatedAt: new Date() })
      .where(eq(settingsTable.key, "site_logo_url"));
    logoUrl = stored || null;
  }

  if (faviconUrl && isDataUrl(faviconUrl)) {
    const stored = normalizeBrandingSettingValue("site_favicon_url", faviconUrl);
    await db
      .update(settingsTable)
      .set({ value: stored, updatedAt: new Date() })
      .where(eq(settingsTable.key, "site_favicon_url"));
    faviconUrl = stored || null;
  }

  res.json({
    platformName: map.platform_name?.trim() || "SellerLens",
    logoUrl,
    faviconUrl,
  });
});

router.post("/forms", async (req, res): Promise<void> => {
  const { formType, email, name, data } = req.body ?? {};

  if (formType !== "support") {
    res.status(400).json({ error: "Unsupported form type" });
    return;
  }

  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  const subject = typeof data?.subject === "string" ? data.subject.trim() : "";
  const message = typeof data?.message === "string" ? data.message.trim() : "";

  if (!trimmedEmail || !subject || !message) {
    res.status(400).json({ error: "Email, subject, and message are required" });
    return;
  }

  const [item] = await db.insert(formSubmissions).values({
    formType: "support",
    email: trimmedEmail,
    name: typeof name === "string" && name.trim() ? name.trim() : null,
    data: { subject, message },
  }).returning();

  res.status(201).json(item);
});

// ─── Authenticated ────────────────────────────────────────────────────────────

/** Lightweight profile for shell/topbar — avoids transactions + billing history. */
router.get("/profile/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const [profile] = await db
    .select({
      fullName: userProfilesTable.fullName,
      onboardingCompleted: userProfilesTable.onboardingCompleted,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  const subRows = await db
    .select({
      planName: plansTable.name,
      status: subscriptionsTable.status,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.userId, userId));
  const credits = await ensureSubscriptionCredits(userId);
  res.json({
    profile: profile ?? null,
    onboardingCompleted: profile?.onboardingCompleted ?? false,
    subscription: subRows[0] ?? null,
    credits,
  });
});

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
    creditAllocations: plansTable.creditAllocations,
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
  const profile = await upsertUserProfile(userId, {
    ...(fullName !== undefined && { fullName: String(fullName) }),
    ...(companyName !== undefined && { companyName: String(companyName) }),
    ...(phone !== undefined && { phone: String(phone) }),
    ...(country !== undefined && { country: String(country) }),
    ...(gstNumber !== undefined && { gstNumber: String(gstNumber) }),
    ...(websiteUrl !== undefined && { websiteUrl: String(websiteUrl) }),
    ...(teamSize !== undefined && { teamSize: teamSize ? Number(teamSize) : null }),
  });
  res.json(profile);
});

const AVATARS_DIR = path.join(process.cwd(), "public", "images", "avatars");

function ensureAvatarDir(): void {
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }
}

router.post("/profile/avatar", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;

  // Collect raw body buffer
  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    try {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        res.status(400).json({ error: "No image data provided" });
        return;
      }
      if (buffer.length > 5 * 1024 * 1024) {
        res.status(400).json({ error: "Image too large. Max 5MB." });
        return;
      }

      // Detect mime type from magic bytes
      let ext = "png";
      let mimeType = "image/png";
      if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        ext = "jpg";
        mimeType = "image/jpeg";
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        ext = "png";
        mimeType = "image/png";
      } else if (buffer[0] === 0x47 && buffer[1] === 0x49) {
        ext = "gif";
        mimeType = "image/gif";
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
        ext = "webp";
        mimeType = "image/webp";
      }

      ensureAvatarDir();

      // Delete old avatar if exists
      const [existing] = await db.select({ avatarUrl: userProfilesTable.avatarUrl }).from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
      if (existing?.avatarUrl) {
        const oldRelativePath = existing.avatarUrl.replace(/^\//, "").replace(/^api\//, "");
        const oldPath = path.join(process.cwd(), "public", oldRelativePath);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      const filename = `${userId}_${Date.now()}.${ext}`;
      const filePath = path.join(AVATARS_DIR, filename);
      const publicUrl = `/api/images/avatars/${filename}`;

      fs.writeFileSync(filePath, buffer);

      // Update DB
      const profileRows = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
      if (profileRows.length) {
        await db.update(userProfilesTable)
          .set({ avatarUrl: publicUrl, updatedAt: new Date() })
          .where(eq(userProfilesTable.userId, userId));
      } else {
        await db.insert(userProfilesTable)
          .values({ userId, avatarUrl: publicUrl });
      }

      res.json({ avatarUrl: publicUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      res.status(500).json({ error: message });
    }
  });
  req.on("error", () => {
    res.status(500).json({ error: "Request error" });
  });
});

router.get("/credits", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const credits = await ensureSubscriptionCredits(userId);
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
    stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
    planName: plansTable.name,
    priceMonthly: plansTable.priceMonthly,
    priceYearly: plansTable.priceYearly,
    planAiCredits: plansTable.aiCredits,
    planImageCredits: plansTable.imageCredits,
    planAuditCredits: plansTable.auditCredits,
    creditAllocations: plansTable.creditAllocations,
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

  // Paid plans require payment gateway
  const planPrice = billingCycle === "yearly" ? plan.priceYearly * 12 : plan.priceMonthly;
  if (planPrice > 0) {
    res.status(400).json({ error: "Paid plans require payment. Use the payment gateway checkout flow instead." });
    return;
  }

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
  const [existingCredits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, userId));
  if (existingCredits) {
    await db.update(creditsTable)
      .set({ aiCredits: existingCredits.aiCredits + plan.aiCredits, imageCredits: existingCredits.imageCredits + plan.imageCredits, auditCredits: existingCredits.auditCredits + plan.auditCredits, updatedAt: now })
      .where(eq(creditsTable.userId, userId));
  } else {
    await db.insert(creditsTable).values({ userId, aiCredits: plan.aiCredits, imageCredits: plan.imageCredits, auditCredits: plan.auditCredits });
  }
  await db.insert(creditTransactionsTable).values([
    { userId, creditType: "ai", amount: plan.aiCredits, reason: `Upgraded to ${plan.name}`, featureType: "subscription" },
    { userId, creditType: "image", amount: plan.imageCredits, reason: `Upgraded to ${plan.name}`, featureType: "subscription" },
    { userId, creditType: "audit", amount: plan.auditCredits, reason: `Upgraded to ${plan.name}`, featureType: "subscription" },
  ]);
  res.json({ success: true });
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
  const invoices = await db.select().from(invoicesTable)
    .where(eq(invoicesTable.userId, userId))
    .orderBy(desc(invoicesTable.createdAt))
    .limit(20);
  res.json({ payments, invoices });
});

router.get("/receipts/:paymentId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const paymentId = parseInt(String(req.params.paymentId ?? ""), 10);
  if (isNaN(paymentId)) { res.status(400).json({ error: "Invalid payment ID" }); return; }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment) { res.status(404).json({ error: "Receipt not found" }); return; }
  if (payment.userId !== userId) { res.status(403).json({ error: "Access denied" }); return; }

  try {
    const { buildReceipt } = await import("../lib/receipt.js");
    const pdf = await buildReceipt(paymentId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${String(paymentId).padStart(6, "0")}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    res.send(pdf);
  } catch (err) {
    req.log?.error?.({ err, paymentId }, "Receipt generation failed");
    res.status(500).json({ error: "Unable to generate receipt. Please try again later or contact support." });
  }
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

  // ─── Trial eligibility validation ───────────────────────────────────────────────────────────────
  if (useTrial) {
    if (!plan.isTrial || plan.trialDays <= 0) {
      res.status(400).json({ error: "This plan does not include a free trial" }); return;
    }
    // Prevent reusing trial after one has already been used
    const existingSub = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    const hadTrialBefore = existingSub.some((s) => s.status === "trial" || (s.status === "active" && s.trialEndsAt !== null));
    if (hadTrialBefore) {
      res.status(400).json({ error: "You have already used a free trial. Please subscribe to continue." }); return;
    }
  }

  // Free plans ($0) and trial starts are handled here. Paid plans go through /api/stripe/create-checkout.
  const planPrice = billingCycle === "yearly" ? plan.priceYearly * 12 : plan.priceMonthly;
  if (!useTrial && planPrice > 0) {
    res.status(400).json({ error: "Paid plans require Stripe checkout. Use /api/stripe/create-checkout." });
    return;
  }

  await upsertUserProfile(userId, {
    fullName,
    companyName,
    phone,
    country,
    gstNumber,
    websiteUrl,
    teamSize,
    onboardingCompleted: true,
  });

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

  const isFreePlan = planPrice === 0;
  const trialEnd = isFreePlan ? null : new Date(now);
  if (!isFreePlan && useTrial) {
    trialEnd!.setDate(trialEnd!.getDate() + (plan.trialDays || 7));
  }

  const existingSub = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  const subData = {
    planId: plan.id,
    billingCycle,
    status: (isFreePlan ? "active" : useTrial ? "trial" : "active"),
    trialEndsAt: isFreePlan ? null : (useTrial ? trialEnd : null),
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    cardLast4: null,
    cardBrand: null,
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
    const ec = existingCredits[0];
    await db.update(creditsTable)
      .set({ aiCredits: ec.aiCredits + plan.aiCredits, imageCredits: ec.imageCredits + plan.imageCredits, auditCredits: ec.auditCredits + plan.auditCredits, updatedAt: new Date() })
      .where(eq(creditsTable.userId, userId));
  } else {
    await db.insert(creditsTable).values({ userId, aiCredits: plan.aiCredits, imageCredits: plan.imageCredits, auditCredits: plan.auditCredits });
  }

  await db.insert(creditTransactionsTable).values([
    { userId, creditType: "ai", amount: plan.aiCredits, reason: `${plan.name} plan — onboarding`, featureType: "subscription" },
    { userId, creditType: "image", amount: plan.imageCredits, reason: `${plan.name} plan — onboarding`, featureType: "subscription" },
    { userId, creditType: "audit", amount: plan.auditCredits, reason: `${plan.name} plan — onboarding`, featureType: "subscription" },
  ]);

  res.json({ ok: true });
});

// ─── Credit Rules (public list of active rules) ──────────────────────────────

router.get("/credit-rules", async (_req, res): Promise<void> => {
  const rules = await db
    .select()
    .from(creditRulesTable)
    .where(eq(creditRulesTable.isActive, true))
    .orderBy(creditRulesTable.sortOrder);
  res.json(rules);
});

// ─── Credit Packs (public list of active packs) ───────────────────────────────

router.get("/credit-packs", async (_req, res): Promise<void> => {
  const packs = await db
    .select()
    .from(creditPacksTable)
    .where(eq(creditPacksTable.isActive, true))
    .orderBy(creditPacksTable.sortOrder);
  res.json(packs);
});

// ─── Buy Credits (credit packs via any gateway) ──────────────────────────────

router.post("/buy-credits", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { packId, paymentMethod, origin } = req.body as {
    packId: number;
    paymentMethod?: "stripe" | "razorpay" | "paypal";
    origin?: string;
  };
  if (!packId || isNaN(Number(packId))) {
    res.status(400).json({ error: "packId is required" });
    return;
  }

  const [pack] = await db
    .select()
    .from(creditPacksTable)
    .where(eq(creditPacksTable.id, Number(packId)));
  if (!pack || !pack.isActive) {
    res.status(404).json({ error: "Credit pack not found or inactive" });
    return;
  }

  const method = paymentMethod ?? "stripe";

  if (method === "stripe") {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();
    const domain = origin ?? process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "http://localhost:80";
    const successUrl = `${baseUrl}/billing?tab=credits&credit_success={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/billing?tab=credits&credit_cancel=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: pack.label ?? `${pack.quantity} ${pack.creditType} credits` },
          unit_amount: pack.priceCents,
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, creditPackId: String(pack.id), type: "credit_pack" },
    });
    res.json({ url: session.url, sessionId: session.id });
    return;
  }

  if (method === "paypal") {
    const { getPayPalAccessToken } = await import("./payment");
    const domain = origin ?? process.env.REPLIT_DOMAINS?.split(",")[0];
    const base = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "http://localhost:80";
    let token: string, baseUrl: string;
    try {
      ({ token, baseUrl } = await getPayPalAccessToken());
    } catch (err) {
      res.status(400).json({ error: (err as Error).message }); return;
    }
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: (pack.priceCents / 100).toFixed(2) },
          description: pack.label ?? `${pack.quantity} ${pack.creditType} credits`,
        }],
        application_context: {
          brand_name: "SellerLens",
          user_action: "PAY_NOW",
          return_url: `${base}/billing?paypal_captured=1`,
          cancel_url: `${base}/billing?paypal_cancelled=1`,
        },
      }),
    });
    const order = await orderRes.json() as { id?: string; links?: Array<{ rel: string; href: string }>; message?: string };
    if (!order.id) { res.status(400).json({ error: order.message ?? "Failed to create PayPal order" }); return; }
    const s = await getGatewaySettings();
    const clientId = s.paypal_client_id ?? "";
    const approvalUrl = order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href ?? "";
    res.json({ orderId: order.id, approvalUrl, clientId, packId: pack.id, packLabel: pack.label });
    return;
  }

  // Razorpay: create order server-side
  const { razorpayFetch } = await import("./payment");
  const keyId = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "razorpay_key_id")).then(r => r[0]?.value ?? "");
  const order = await razorpayFetch<{ id: string; amount: number; currency: string; error?: { description: string } }>(
    "/orders", "POST",
    { amount: pack.priceCents, currency: "USD", receipt: `rcpt_${Date.now()}` },
  );
  if (order.error) { res.status(400).json({ error: order.error.description }); return; }
  res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, packId: pack.id, packLabel: pack.label });
});

// ─── Buy Custom Credits (Stripe checkout for arbitrary amounts) ─────────────────

router.post("/buy-custom-credits", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { amount, creditType, paymentMethod, origin } = req.body as { amount: number; creditType: string; paymentMethod?: "stripe" | "razorpay" | "paypal"; origin?: string };
  if (!amount || amount < 10 || amount > 10000 || !creditType || !["ai", "image", "audit"].includes(creditType)) {
    res.status(400).json({ error: "Invalid amount (10-10000) or creditType (ai/image/audit)" });
    return;
  }
  const priceCents = amount * 10; // $0.10 per credit
  const method = paymentMethod ?? "stripe";

  if (method === "stripe") {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();
    const domain = origin ?? process.env.REPLIT_DOMAINS?.split(",")[0];
    const baseUrl = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "http://localhost:80";
    const successUrl = `${baseUrl}/billing?tab=credits&custom_credit_success={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/billing?tab=credits&credit_cancel=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `${amount} ${creditType} credits` },
          unit_amount: priceCents,
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, customCredits: String(amount), creditType, type: "custom_credit" },
    });
    res.json({ url: session.url, sessionId: session.id });
    return;
  }

  if (method === "paypal") {
    const { getPayPalAccessToken } = await import("./payment");
    const domain = origin ?? process.env.REPLIT_DOMAINS?.split(",")[0];
    const base = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "http://localhost:80";
    let token: string, baseUrl: string;
    try {
      ({ token, baseUrl } = await getPayPalAccessToken());
    } catch (err) {
      res.status(400).json({ error: (err as Error).message }); return;
    }
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: (priceCents / 100).toFixed(2) },
          description: `${amount} ${creditType} credits`,
        }],
        application_context: {
          brand_name: "SellerLens",
          user_action: "PAY_NOW",
          return_url: `${base}/billing?paypal_captured=1`,
          cancel_url: `${base}/billing?paypal_cancelled=1`,
        },
      }),
    });
    const order = await orderRes.json() as { id?: string; links?: Array<{ rel: string; href: string }>; message?: string };
    if (!order.id) { res.status(400).json({ error: order.message ?? "Failed to create PayPal order" }); return; }
    const s = await getGatewaySettings();
    const clientId = s.paypal_client_id ?? "";
    const approvalUrl = order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href ?? "";
    res.json({ orderId: order.id, approvalUrl, clientId, creditType, creditAmount: amount });
    return;
  }

  // Razorpay
  const { razorpayFetch } = await import("./payment");
  const keyId = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "razorpay_key_id")).then(r => r[0]?.value ?? "");
  const order = await razorpayFetch<{ id: string; amount: number; currency: string; error?: { description: string } }>(
    "/orders", "POST",
    { amount: priceCents, currency: "USD", receipt: `rcpt_${Date.now()}` },
  );
  if (order.error) { res.status(400).json({ error: order.error.description }); return; }
  res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, creditType, creditAmount: amount });
});

// ─── Confirm Credit Purchase (Stripe webhook or direct confirm) ───────────────

router.post("/buy-credits/confirm", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

  const { getUncachableStripeClient } = await import("../stripeClient");
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const metaUserId = session.metadata?.userId;
  if (metaUserId && metaUserId !== userId) {
    res.status(403).json({ error: "Session does not belong to this account" });
    return;
  }

  const result = await fulfillStripeCreditCheckout(session);
  if (!result) {
    res.status(400).json({ error: "Not a credit purchase session or payment not completed" });
    return;
  }

  res.json({
    success: true,
    alreadyProcessed: result.alreadyProcessed,
    addedCredits: result.addedCredits,
    newBalance: result.newBalance,
    creditType: result.creditType,
  });
});

// ─── Credit Usage Breakdown ───────────────────────────────────────────────────

async function workspaceUserIds(userId: string): Promise<string[]> {
  const [membership] = await db
    .select({ ownerUserId: teamMembersTable.ownerUserId })
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.memberUserId, userId), eq(teamMembersTable.status, "active")));

  if (membership) {
    return [userId];
  }

  const members = await db
    .select({ memberUserId: teamMembersTable.memberUserId })
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.ownerUserId, userId), eq(teamMembersTable.status, "active")));

  const ids = new Set<string>([userId]);
  for (const m of members) {
    if (m.memberUserId) ids.add(m.memberUserId);
  }
  return [...ids];
}

router.get("/credit-usage", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const userIds = await workspaceUserIds(userId);

  const transactions = await db
    .select()
    .from(creditTransactionsTable)
    .where(inArray(creditTransactionsTable.userId, userIds))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(500);

  const breakdown: Record<string, { spent: number; earned: number; count: number }> = {};
  let totalSpent = 0;
  let totalEarned = 0;
  const refunded = refundedDebitIds(transactions as CreditUsageTx[]);

  for (const tx of transactions) {
    const ft = tx.featureType ?? "other";
    if (!breakdown[ft]) breakdown[ft] = { spent: 0, earned: 0, count: 0 };
    breakdown[ft].count++;
    if (tx.amount < 0) {
      if (isRefundedDebit(tx as CreditUsageTx, refunded)) continue;
      const spent = Math.abs(tx.amount);
      breakdown[ft].spent += spent;
      if (ft !== "subscription") totalSpent += spent;
    } else {
      breakdown[ft].earned += tx.amount;
      totalEarned += tx.amount;
    }
  }

  res.json({
    transactions,
    breakdown,
    totalSpent,
    totalEarned,
    workspaceUserIds: userIds,
  });
});

// ─── Customer Notifications ────────────────────────────────────────────────

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.sentAt))
    .limit(limit);
  res.json({ notifications });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const id = parseInt(String(req.params.id ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(notificationsTable).set({ read: true, readAt: new Date() }).where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
  res.json({ ok: true });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  await db.update(notificationsTable).set({ read: true, readAt: new Date() }).where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));
  res.json({ ok: true });
});

export default router;
