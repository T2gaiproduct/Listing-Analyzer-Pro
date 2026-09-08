import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

let migrated = false;

/** Additive columns for product_orders (payment status from marketplace sync). */
export async function ensureProductOrdersSchemaMigrated(): Promise<void> {
  if (migrated) return;

  await db.execute(sql`
    ALTER TABLE product_orders
    ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending'
  `);

  migrated = true;
}
