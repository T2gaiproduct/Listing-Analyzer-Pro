import { db, pool, couponsTable } from "./index.js";
import { sql } from "drizzle-orm";

const SEED_COUPONS = [
  {
    code: "LAUNCH20",
    description: "Launch offer — 20% off any plan",
    discountPercent: 20,
    maxUses: 10_000,
    isActive: true,
  },
];

async function seed() {
  console.log("Seeding coupons...");
  for (const coupon of SEED_COUPONS) {
    const [existing] = await db
      .select({ id: couponsTable.id })
      .from(couponsTable)
      .where(sql`upper(${couponsTable.code}) = ${coupon.code}`);

    if (existing) {
      console.log(`  ⏭  Skipping "${coupon.code}" — already exists (id ${existing.id})`);
      continue;
    }

    const [inserted] = await db.insert(couponsTable).values(coupon).returning({ id: couponsTable.id });
    console.log(`  ✓  Inserted "${coupon.code}" (id ${inserted!.id})`);
  }
  console.log("Done.");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
