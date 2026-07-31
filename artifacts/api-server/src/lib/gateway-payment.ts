import { and, eq } from "drizzle-orm";
import {
  db,
  plansTable,
  creditPacksTable,
  paymentsTable,
  subscriptionsTable,
  creditsTable,
  creditTransactionsTable,
  type Plan,
} from "@workspace/db";
import { resolveCoupon, computeCouponDiscountAmount } from "./coupon-validation.js";
import { isGatewayPaymentProcessed } from "./subscription-fulfillment";
import { addCredits, type CreditType } from "./credits";
import { planRowToGrantCredits } from "./plan-credits";
import { upsertUserProfile } from "./user-profile";
import { incrementCouponUsage } from "./coupon-validation.js";

export const CUSTOM_CREDIT_CENTS = 10;

export type GatewayPaymentIntent =
  | { type: "card_setup" }
  | {
    type: "plan";
    planId: number;
    billingCycle: "monthly" | "yearly";
    couponCode?: string;
    profile?: {
      fullName?: string;
      companyName?: string;
      phone?: string;
      country?: string;
      gstNumber?: string;
      websiteUrl?: string;
      teamSize?: number;
    };
  }
  | { type: "credit_pack"; packId: number }
  | { type: "custom_credit"; creditType: CreditType; creditAmount: number };

export interface ResolvedGatewayOrder {
  amountCents: number;
  amountDollars: number;
  currency: string;
  intent: GatewayPaymentIntent;
  planId?: number;
}

export async function computePlanChargeDollars(
  plan: Plan,
  billingCycle: "monthly" | "yearly",
  couponCode?: string,
): Promise<{ amountDollars: number; appliedCouponCode: string | null; discountAmount: number }> {
  const chargeBase = billingCycle === "yearly" ? plan.priceYearly * 12 : plan.priceMonthly;
  let discountAmount = 0;
  let appliedCouponCode: string | null = null;

  if (couponCode) {
    const couponResult = await resolveCoupon(couponCode);
    if (!couponResult.ok) {
      throw new Error("Invalid coupon");
    }
    appliedCouponCode = couponResult.coupon.code;
    discountAmount = computeCouponDiscountAmount(couponResult.coupon, chargeBase);
  }

  return {
    amountDollars: Math.max(0, chargeBase - discountAmount),
    appliedCouponCode,
    discountAmount,
  };
}

export async function resolveGatewayOrder(
  userId: string,
  body: {
    planId?: number;
    billingCycle?: string;
    couponCode?: string;
    packId?: number;
    creditType?: string;
    creditAmount?: number;
    currency?: string;
    fullName?: string;
    companyName?: string;
    phone?: string;
    country?: string;
    gstNumber?: string;
    websiteUrl?: string;
    teamSize?: number;
  },
): Promise<ResolvedGatewayOrder> {
  const currency = body.currency ?? "USD";

  if (body.packId) {
    const [pack] = await db.select().from(creditPacksTable).where(eq(creditPacksTable.id, body.packId));
    if (!pack || !pack.isActive) {
      throw new Error("Credit pack not found or inactive");
    }
    return {
      amountCents: pack.priceCents,
      amountDollars: pack.priceCents / 100,
      currency: "USD",
      intent: { type: "credit_pack", packId: pack.id },
    };
  }

  if (body.creditType && body.creditAmount) {
    if (!["ai", "image", "audit"].includes(body.creditType)) {
      throw new Error("Invalid credit type");
    }
    if (body.creditAmount < 10 || body.creditAmount > 10000) {
      throw new Error("Invalid credit amount");
    }
    const amountCents = body.creditAmount * CUSTOM_CREDIT_CENTS;
    return {
      amountCents,
      amountDollars: amountCents / 100,
      currency: "USD",
      intent: {
        type: "custom_credit",
        creditType: body.creditType as CreditType,
        creditAmount: body.creditAmount,
      },
    };
  }

  if (body.planId) {
    const billingCycle = body.billingCycle === "yearly" ? "yearly" : "monthly";
    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, body.planId));
    if (!plan) throw new Error("Invalid plan");

    const { amountDollars } = await computePlanChargeDollars(plan, billingCycle, body.couponCode);
    return {
      amountCents: Math.round(amountDollars * 100),
      amountDollars,
      currency,
      intent: {
        type: "plan",
        planId: plan.id,
        billingCycle,
        couponCode: body.couponCode,
        profile: {
          fullName: body.fullName,
          companyName: body.companyName,
          phone: body.phone,
          country: body.country,
          gstNumber: body.gstNumber,
          websiteUrl: body.websiteUrl,
          teamSize: body.teamSize,
        },
      },
      planId: plan.id,
    };
  }

  // Default: card setup authorization ($1 / ₹1)
  const setupAmountCents = currency === "INR" ? 100 : 100;
  return {
    amountCents: setupAmountCents,
    amountDollars: setupAmountCents / 100,
    currency,
    intent: { type: "card_setup" },
  };
}

export async function recordPendingGatewayPayment(params: {
  userId: string;
  gateway: "razorpay" | "paypal";
  gatewayOrderId: string;
  amountCents: number;
  currency: string;
  intent: GatewayPaymentIntent;
  planId?: number;
}): Promise<void> {
  await db.insert(paymentsTable).values({
    userId: params.userId,
    amount: params.amountCents / 100,
    currency: params.currency,
    status: "pending",
    gateway: params.gateway,
    gatewayPaymentId: params.gatewayOrderId,
    planId: params.planId,
    metadata: { intent: params.intent },
  });
}

export async function findPendingGatewayPayment(
  gateway: "razorpay" | "paypal",
  gatewayOrderId: string,
  userId: string,
) {
  const [row] = await db
    .select()
    .from(paymentsTable)
    .where(and(
      eq(paymentsTable.gateway, gateway),
      eq(paymentsTable.gatewayPaymentId, gatewayOrderId),
      eq(paymentsTable.userId, userId),
      eq(paymentsTable.status, "pending"),
    ))
    .limit(1);
  return row ?? null;
}

function paymentAmountMatches(expectedCents: number, paidCents: number): boolean {
  return Math.abs(paidCents - expectedCents) <= 2;
}

export async function fulfillGatewayPaymentIntent(params: {
  userId: string;
  gateway: "razorpay" | "paypal";
  gatewayPaymentId: string;
  gatewayOrderId: string;
  paidAmountCents: number;
  currency: string;
  payerEmail?: string;
}): Promise<{
  success: true;
  alreadyProcessed: boolean;
  addedCredits?: number;
  creditType?: CreditType;
  newBalance?: number;
  payer?: string;
}> {
  if (await isGatewayPaymentProcessed(params.gatewayPaymentId)) {
    return { success: true, alreadyProcessed: true, payer: params.payerEmail };
  }

  const pending = await findPendingGatewayPayment(
    params.gateway,
    params.gatewayOrderId,
    params.userId,
  );
  if (!pending) {
    throw new Error("Payment order not found or already fulfilled");
  }

  const expectedCents = Math.round(Number(pending.amount) * 100);
  if (!paymentAmountMatches(expectedCents, params.paidAmountCents)) {
    throw new Error("Payment amount mismatch");
  }

  const intent = (pending.metadata as { intent?: GatewayPaymentIntent } | null)?.intent;
  if (!intent) {
    throw new Error("Invalid payment metadata");
  }

  const now = new Date();
  const amountDollars = params.paidAmountCents / 100;

  if (intent.type === "card_setup") {
    const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, params.userId));
    if (existing) {
      await db.update(subscriptionsTable)
        .set({
          cardBrand: params.gateway === "razorpay" ? "Razorpay" : "PayPal",
          cardLast4: params.gateway === "razorpay" ? "rzpy" : (params.payerEmail?.slice(-4) || "ppal"),
          updatedAt: now,
        })
        .where(eq(subscriptionsTable.userId, params.userId));
    }

    await db.update(paymentsTable)
      .set({
        status: "completed",
        gatewayPaymentId: params.gatewayPaymentId,
        amount: amountDollars,
        currency: params.currency,
        updatedAt: now,
      })
      .where(eq(paymentsTable.id, pending.id));

    return { success: true, alreadyProcessed: false, payer: params.payerEmail };
  }

  if (intent.type === "custom_credit") {
    const newBalance = await addCredits(
      params.userId,
      intent.creditType,
      intent.creditAmount,
      `Purchased ${intent.creditAmount} ${intent.creditType} credits via ${params.gateway}`,
      "custom_credit_purchase",
      { gatewayPaymentId: params.gatewayPaymentId, gateway: params.gateway },
    );

    await db.update(paymentsTable)
      .set({
        status: "completed",
        gatewayPaymentId: params.gatewayPaymentId,
        amount: amountDollars,
        currency: params.currency,
        metadata: {
          type: "custom_credit",
          credits: intent.creditAmount,
          creditType: intent.creditType,
        },
        updatedAt: now,
      })
      .where(eq(paymentsTable.id, pending.id));

    return {
      success: true,
      alreadyProcessed: false,
      addedCredits: intent.creditAmount,
      creditType: intent.creditType,
      newBalance,
      payer: params.payerEmail,
    };
  }

  if (intent.type === "credit_pack") {
    const [pack] = await db.select().from(creditPacksTable).where(eq(creditPacksTable.id, intent.packId));
    if (!pack) throw new Error("Credit pack not found");

    const creditType = pack.creditType as CreditType;
    const newBalance = await addCredits(
      params.userId,
      creditType,
      pack.quantity,
      `Purchased ${pack.quantity} ${pack.creditType} credits (${pack.label ?? `Pack #${pack.id}`}) via ${params.gateway}`,
      "credit_pack_purchase",
      { packId: pack.id, priceCents: pack.priceCents, gatewayPaymentId: params.gatewayPaymentId },
    );

    await db.update(paymentsTable)
      .set({
        status: "completed",
        gatewayPaymentId: params.gatewayPaymentId,
        amount: amountDollars,
        currency: params.currency,
        metadata: {
          type: "credit_pack",
          packId: pack.id,
          credits: pack.quantity,
          creditType: pack.creditType,
        },
        updatedAt: now,
      })
      .where(eq(paymentsTable.id, pending.id));

    return {
      success: true,
      alreadyProcessed: false,
      addedCredits: pack.quantity,
      creditType,
      newBalance,
      payer: params.payerEmail,
    };
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, intent.planId));
  if (!plan) throw new Error("Plan not found");

  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + (intent.billingCycle === "yearly" ? 12 : 1));

  const [existingSub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, params.userId));
  const subData = {
    planId: intent.planId,
    billingCycle: intent.billingCycle,
    status: "active" as const,
    trialEndsAt: null,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    autoRenew: true,
    cardBrand: params.gateway === "razorpay" ? "Razorpay" : "PayPal",
    cardLast4: params.gateway === "razorpay" ? "rzpy" : (params.payerEmail?.slice(-4) || "ppal"),
    updatedAt: now,
  };

  if (existingSub) {
    await db.update(subscriptionsTable).set(subData).where(eq(subscriptionsTable.userId, params.userId));
  } else {
    await db.insert(subscriptionsTable).values({ userId: params.userId, ...subData });
  }

  const grantCredits = await planRowToGrantCredits(plan);
  const [existingCredits] = await db.select().from(creditsTable).where(eq(creditsTable.userId, params.userId));
  if (existingCredits) {
    await db.update(creditsTable)
      .set({
        aiCredits: existingCredits.aiCredits + grantCredits.aiCredits,
        imageCredits: existingCredits.imageCredits + grantCredits.imageCredits,
        auditCredits: existingCredits.auditCredits + grantCredits.auditCredits,
        updatedAt: now,
      })
      .where(eq(creditsTable.userId, params.userId));
  } else {
    await db.insert(creditsTable).values({
      userId: params.userId,
      aiCredits: grantCredits.aiCredits,
      imageCredits: grantCredits.imageCredits,
      auditCredits: grantCredits.auditCredits,
    });
  }

  await db.insert(creditTransactionsTable).values([
    { userId: params.userId, creditType: "ai", amount: grantCredits.aiCredits, reason: `${plan.name} plan — ${params.gateway} payment confirmed`, featureType: "subscription" },
    { userId: params.userId, creditType: "image", amount: grantCredits.imageCredits, reason: `${plan.name} plan — ${params.gateway} payment confirmed`, featureType: "subscription" },
    { userId: params.userId, creditType: "audit", amount: grantCredits.auditCredits, reason: `${plan.name} plan — ${params.gateway} payment confirmed`, featureType: "subscription" },
  ]);

  await upsertUserProfile(params.userId, {
    ...(intent.profile?.fullName !== undefined && { fullName: intent.profile.fullName }),
    ...(intent.profile?.companyName !== undefined && { companyName: intent.profile.companyName }),
    ...(intent.profile?.phone !== undefined && { phone: intent.profile.phone }),
    ...(intent.profile?.country !== undefined && { country: intent.profile.country }),
    ...(intent.profile?.gstNumber !== undefined && { gstNumber: intent.profile.gstNumber }),
    ...(intent.profile?.websiteUrl !== undefined && { websiteUrl: intent.profile.websiteUrl }),
    ...(intent.profile?.teamSize !== undefined && { teamSize: intent.profile.teamSize }),
    onboardingCompleted: true,
  });

  if (intent.couponCode) {
    const couponResult = await resolveCoupon(intent.couponCode);
    if (couponResult.ok) {
      await incrementCouponUsage(couponResult.coupon.id, couponResult.coupon.usedCount);
    }
  }

  await db.update(paymentsTable)
    .set({
      status: "completed",
      gatewayPaymentId: params.gatewayPaymentId,
      amount: amountDollars,
      currency: params.currency,
      planId: intent.planId,
      updatedAt: now,
    })
    .where(eq(paymentsTable.id, pending.id));

  return { success: true, alreadyProcessed: false, payer: params.payerEmail };
}
