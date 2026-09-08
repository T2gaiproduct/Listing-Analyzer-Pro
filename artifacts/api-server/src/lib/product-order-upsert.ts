import { and, eq, sql } from "drizzle-orm";
import { db, productOrdersTable } from "@workspace/db";
import type { ProductOrderStatus, ProductOrderPaymentStatus } from "./product-orders.js";
import { ensureProductOrdersSchemaMigrated } from "./ensure-product-orders-schema.js";
import { isMissingProductOrdersColumnError } from "./product-order-sync-errors.js";

type ProductOrderValues = {
  auditId: number;
  workspaceId: number;
  orderNumber: string;
  marketplace: string;
  customerName: string;
  quantity: number;
  amountCents: number;
  currency: string;
  status: ProductOrderStatus;
  paymentStatus: ProductOrderPaymentStatus;
  orderedAt: Date;
  trackingNumber: string | null;
};

function buildInsertValues(input: ProductOrderValues) {
  const tracking = input.trackingNumber?.trim() || null;
  return {
    auditId: input.auditId,
    workspaceId: input.workspaceId,
    orderNumber: input.orderNumber,
    marketplace: input.marketplace,
    customerName: input.customerName,
    quantity: input.quantity,
    amountCents: input.amountCents,
    currency: input.currency,
    status: input.status,
    paymentStatus: input.paymentStatus,
    orderedAt: input.orderedAt,
    ...(tracking ? { trackingNumber: tracking } : {}),
  };
}

function buildUpdateValues(input: ProductOrderValues) {
  const tracking = input.trackingNumber?.trim() || null;
  return {
    customerName: input.customerName,
    quantity: input.quantity,
    amountCents: input.amountCents,
    currency: input.currency,
    status: input.status,
    paymentStatus: input.paymentStatus,
    orderedAt: input.orderedAt,
    trackingNumber: tracking,
  };
}

async function insertLegacyProductOrderRow(input: ProductOrderValues): Promise<void> {
  const tracking = input.trackingNumber?.trim() || null;
  await db.execute(sql`
    INSERT INTO product_orders (
      audit_id,
      workspace_id,
      order_number,
      marketplace,
      customer_name,
      quantity,
      amount_cents,
      currency,
      status,
      ordered_at,
      tracking_number
    ) VALUES (
      ${input.auditId},
      ${input.workspaceId},
      ${input.orderNumber},
      ${input.marketplace},
      ${input.customerName},
      ${input.quantity},
      ${input.amountCents},
      ${input.currency},
      ${input.status},
      ${input.orderedAt},
      ${tracking}
    )
  `);
}

async function updateLegacyProductOrderRow(id: number, input: ProductOrderValues): Promise<void> {
  const tracking = input.trackingNumber?.trim() || null;
  await db.execute(sql`
    UPDATE product_orders
    SET
      customer_name = ${input.customerName},
      quantity = ${input.quantity},
      amount_cents = ${input.amountCents},
      currency = ${input.currency},
      status = ${input.status},
      ordered_at = ${input.orderedAt},
      tracking_number = ${tracking}
    WHERE id = ${id}
  `);
}

async function insertProductOrderRow(input: ProductOrderValues): Promise<void> {
  const values = buildInsertValues(input);
  try {
    await db.insert(productOrdersTable).values(values);
  } catch (err) {
    if (!isMissingProductOrdersColumnError(err, "payment_status")) {
      throw err;
    }
    await insertLegacyProductOrderRow(input);
  }
}

async function updateProductOrderRow(id: number, input: ProductOrderValues): Promise<void> {
  const values = buildUpdateValues(input);
  try {
    await db.update(productOrdersTable)
      .set(values)
      .where(eq(productOrdersTable.id, id));
  } catch (err) {
    if (!isMissingProductOrdersColumnError(err, "payment_status")) {
      throw err;
    }
    await updateLegacyProductOrderRow(id, input);
  }
}

export async function upsertProductOrderRow(input: ProductOrderValues): Promise<"imported" | "updated"> {
  await ensureProductOrdersSchemaMigrated();

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

  if (existing) {
    await updateProductOrderRow(existing.id, input);
    return "updated";
  }

  await insertProductOrderRow(input);
  return "imported";
}
