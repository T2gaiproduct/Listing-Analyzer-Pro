import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  db, creditPacksTable, paymentsTable, invoicesTable,
} from "@workspace/db";
import { addCredits, type CreditType } from "./credits";
import { logger } from "./logger";

export interface CreditCheckoutFulfillment {
  success: boolean;
  alreadyProcessed: boolean;
  addedCredits: number;
  creditType: CreditType;
  newBalance: number;
  userId: string;
}

function isCreditType(value: string): value is CreditType {
  return value === "ai" || value === "image" || value === "audit";
}

/**
 * Fulfill a one-time Stripe Checkout session for custom or pack credit purchases.
 * Idempotent — safe to call from client confirm and checkout.session.completed webhook.
 */
export async function fulfillStripeCreditCheckout(
  session: Stripe.Checkout.Session,
): Promise<CreditCheckoutFulfillment | null> {
  const meta = session.metadata ?? {};
  const purchaseType = meta.type;
  if (purchaseType !== "custom_credit" && purchaseType !== "credit_pack") {
    return null;
  }

  const userId = meta.userId;
  if (!userId || typeof userId !== "string") {
    logger.warn({ sessionId: session.id }, "Credit checkout missing userId metadata");
    return null;
  }

  if (session.payment_status !== "paid") {
    logger.warn({ sessionId: session.id, status: session.payment_status }, "Credit checkout not paid");
    return null;
  }

  const sessionId = session.id;
  const [existingPayment] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.gatewayPaymentId, sessionId))
    .limit(1);

  if (existingPayment) {
    const existingMeta = existingPayment.metadata as Record<string, unknown> | null;
    const creditType = (existingMeta?.creditType as CreditType) ?? "audit";
    const addedCredits = Number(existingMeta?.credits ?? 0);
    return {
      success: true,
      alreadyProcessed: true,
      addedCredits,
      creditType,
      newBalance: addedCredits,
      userId: existingPayment.userId,
    };
  }

  if (purchaseType === "custom_credit") {
    const amount = Number(meta.customCredits);
    const creditType = meta.creditType;
    if (!amount || !creditType || !isCreditType(creditType)) {
      logger.warn({ sessionId }, "Invalid custom credit checkout metadata");
      return null;
    }

    const priceDollars = (amount * 10) / 100;
    const newBalance = await addCredits(
      userId,
      creditType,
      amount,
      `Purchased ${amount} ${creditType} credits`,
      "custom_credit_purchase",
      { sessionId, priceCents: amount * 10 },
    );

    const [payment] = await db.insert(paymentsTable).values({
      userId,
      amount: priceDollars,
      currency: "USD",
      status: "completed",
      gateway: "stripe",
      gatewayPaymentId: sessionId,
      metadata: { type: "custom_credit", credits: amount, creditType },
    }).returning();

    const [invoice] = await db.insert(invoicesTable).values({
      userId,
      amount: priceDollars,
      currency: "USD",
      status: "paid",
      items: [{ description: `${amount} ${creditType} credits`, quantity: amount, amount: priceDollars }],
      paidAt: new Date(),
    }).returning();

    if (payment && invoice) {
      await db.update(paymentsTable).set({ invoiceId: invoice.id }).where(eq(paymentsTable.id, payment.id));
    }

    logger.info({ userId, amount, creditType, sessionId }, "Custom credit purchase fulfilled");
    return { success: true, alreadyProcessed: false, addedCredits: amount, creditType, newBalance, userId };
  }

  const packId = Number(meta.creditPackId);
  if (!packId || Number.isNaN(packId)) {
    logger.warn({ sessionId }, "Invalid credit pack checkout metadata");
    return null;
  }

  const [pack] = await db.select().from(creditPacksTable).where(eq(creditPacksTable.id, packId));
  if (!pack) {
    logger.warn({ sessionId, packId }, "Credit pack not found for checkout");
    return null;
  }

  const creditType = pack.creditType as CreditType;
  const newBalance = await addCredits(
    userId,
    creditType,
    pack.quantity,
    `Purchased ${pack.quantity} ${pack.creditType} credits`,
    "credit_pack_purchase",
    { packId: pack.id, priceCents: pack.priceCents, sessionId },
  );

  const amount = pack.priceCents / 100;
  const [payment] = await db.insert(paymentsTable).values({
    userId,
    amount,
    currency: "USD",
    status: "completed",
    gateway: "stripe",
    gatewayPaymentId: sessionId,
    metadata: { type: "credit_pack", packId: pack.id, credits: pack.quantity, creditType: pack.creditType },
  }).returning();

  const [invoice] = await db.insert(invoicesTable).values({
    userId,
    amount,
    currency: "USD",
    status: "paid",
    items: [{
      description: `${pack.quantity} ${pack.creditType} credits (${pack.label ?? `Pack #${pack.id}`})`,
      quantity: pack.quantity,
      amount,
    }],
    paidAt: new Date(),
  }).returning();

  if (payment && invoice) {
    await db.update(paymentsTable).set({ invoiceId: invoice.id }).where(eq(paymentsTable.id, payment.id));
  }

  logger.info({ userId, packId, quantity: pack.quantity, creditType, sessionId }, "Credit pack purchase fulfilled");
  return {
    success: true,
    alreadyProcessed: false,
    addedCredits: pack.quantity,
    creditType,
    newBalance,
    userId,
  };
}
