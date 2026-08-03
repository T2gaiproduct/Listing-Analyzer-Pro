import { eq } from "drizzle-orm";
import { db, paymentsTable, plansTable, userProfilesTable } from "@workspace/db";
import { buildReceiptPdfBytes, type ReceiptPdfInput } from "./receipt-pdf-layout.js";

export async function buildReceipt(paymentId: number): Promise<Buffer> {
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment) throw new Error("Payment not found");

  let planName: string | null = null;
  let billingCycle: string | null = null;
  if (payment.planId) {
    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, payment.planId));
    if (plan) {
      planName = plan.name;
      billingCycle = (payment.metadata as Record<string, unknown>)?.billingCycle as string ?? "monthly";
    }
  }

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, payment.userId));

  const data: ReceiptPdfInput = {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    gateway: payment.gateway,
    gatewayPaymentId: payment.gatewayPaymentId,
    createdAt: String(payment.createdAt),
    planName,
    billingCycle,
    customerName: profile?.fullName ?? null,
    companyName: profile?.companyName ?? null,
    email: null,
  };

  const bytes = await buildReceiptPdfBytes(data);
  return Buffer.from(bytes);
}
