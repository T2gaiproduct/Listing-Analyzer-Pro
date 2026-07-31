import { and, desc, eq } from "drizzle-orm";
import { db, paymentsTable } from "@workspace/db";
import { capturePayPalOrderForUser } from "../routes/payment";

/**
 * PayPal checkout creates a pending row before redirect. If capture never runs
 * (onboarding gate blocked /billing return), reconcile APPROVED/COMPLETED orders.
 */
export async function reconcilePendingPayPalPayments(userId: string): Promise<boolean> {
  const pendingRows = await db
    .select()
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.userId, userId),
        eq(paymentsTable.gateway, "paypal"),
        eq(paymentsTable.status, "pending"),
      ),
    )
    .orderBy(desc(paymentsTable.createdAt))
    .limit(10);

  let fulfilled = false;
  for (const row of pendingRows) {
    const orderId = row.gatewayPaymentId;
    if (!orderId) continue;
    try {
      const result = await capturePayPalOrderForUser(userId, orderId);
      if (result.success && !result.alreadyProcessed) {
        fulfilled = true;
      }
    } catch {
      /* CREATED / void orders — skip */
    }
  }
  return fulfilled;
}
