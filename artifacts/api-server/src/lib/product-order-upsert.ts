import { and, eq } from "drizzle-orm";
import { db, productOrdersTable } from "@workspace/db";
import type { ProductOrderStatus } from "./product-orders.js";

export async function upsertProductOrderRow(input: {
  auditId: number;
  workspaceId: number;
  marketplace: string;
  orderNumber: string;
  customerName: string;
  quantity: number;
  amountCents: number;
  currency: string;
  status: ProductOrderStatus;
  orderedAt: Date;
  trackingNumber: string | null;
}): Promise<"imported" | "updated"> {
  const [existing] = await db
    .select({ id: productOrdersTable.id })
    .from(productOrdersTable)
    .where(and(
      eq(productOrdersTable.auditId, input.auditId),
      eq(productOrdersTable.marketplace, input.marketplace),
      eq(productOrdersTable.orderNumber, input.orderNumber),
      eq(productOrdersTable.isDeleted, 0),
    ))
    .limit(1);

  const values = {
    auditId: input.auditId,
    workspaceId: input.workspaceId,
    orderNumber: input.orderNumber,
    marketplace: input.marketplace,
    customerName: input.customerName,
    quantity: input.quantity,
    amountCents: input.amountCents,
    currency: input.currency,
    status: input.status,
    orderedAt: input.orderedAt,
    trackingNumber: input.trackingNumber,
  };

  if (existing) {
    await db
      .update(productOrdersTable)
      .set({
        customerName: values.customerName,
        quantity: values.quantity,
        amountCents: values.amountCents,
        currency: values.currency,
        status: values.status,
        orderedAt: values.orderedAt,
        trackingNumber: values.trackingNumber,
      })
      .where(eq(productOrdersTable.id, existing.id));
    return "updated";
  }

  await db.insert(productOrdersTable).values(values);
  return "imported";
}
