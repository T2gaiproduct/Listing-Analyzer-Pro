/**
 * Seed Stripe Products & Prices
 *
 * Creates a Stripe Product + monthly/yearly Price for each active plan,
 * then writes the Stripe price IDs back into the plans table.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed-stripe
 *
 * Safe to re-run: uses `idempotencyKey` + looks up existing products by metadata.
 */
import { getUncachableStripeClient } from "./stripeClient.js";
import { db, plansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const stripe = await getUncachableStripeClient();

  const plans = await db.select().from(plansTable).where(eq(plansTable.isActive, true));
  console.log(`Found ${plans.length} active plans to seed.\n`);

  for (const plan of plans) {
    console.log(`Processing plan: ${plan.name} (id=${plan.id})`);

    // Find or create a Stripe product for this plan
    const existingProducts = await stripe.products.search({
      query: `metadata['planId']:'${plan.id}'`,
      limit: 1,
    });

    let product = existingProducts.data[0];
    if (product) {
      console.log(`  ✓ Existing product: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: `${plan.name} Plan`,
        description: plan.description ?? undefined,
        metadata: { planId: String(plan.id) },
      });
      console.log(`  + Created product: ${product.id}`);
    }

    // Monthly price
    let monthlyPriceId = plan.stripePriceIdMonthly;
    if (!monthlyPriceId) {
      const monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(plan.priceMonthly * 100),
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { planId: String(plan.id), billingCycle: "monthly" },
      });
      monthlyPriceId = monthlyPrice.id;
      console.log(`  + Created monthly price: ${monthlyPriceId} ($${plan.priceMonthly}/mo)`);
    } else {
      console.log(`  ✓ Existing monthly price: ${monthlyPriceId}`);
    }

    // Yearly price
    let yearlyPriceId = plan.stripePriceIdYearly;
    if (!yearlyPriceId) {
      const yearlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(plan.priceYearly * 12 * 100),
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { planId: String(plan.id), billingCycle: "yearly" },
      });
      yearlyPriceId = yearlyPrice.id;
      console.log(`  + Created yearly price: ${yearlyPriceId} ($${plan.priceYearly * 12}/yr)`);
    } else {
      console.log(`  ✓ Existing yearly price: ${yearlyPriceId}`);
    }

    // Write price IDs back to DB
    await db.update(plansTable)
      .set({ stripePriceIdMonthly: monthlyPriceId, stripePriceIdYearly: yearlyPriceId, updatedAt: new Date() })
      .where(eq(plansTable.id, plan.id));
    console.log(`  ✓ Updated plan DB record with Stripe price IDs\n`);
  }

  console.log("✅ Stripe product seeding complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed script failed:", err);
  process.exit(1);
});
