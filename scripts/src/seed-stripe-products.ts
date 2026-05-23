/**
 * Seed Stripe Products & Prices
 *
 * Creates a Stripe Product + monthly/yearly Price for each active plan,
 * then writes the Stripe price IDs back into the plans table.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed-stripe
 *
 * Safe to re-run: checks existing products by metadata before creating.
 */
import pg from "pg";
import { getUncachableStripeClient } from "./stripeClient.js";

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const stripe = await getUncachableStripeClient();

  const { rows: plans } = await client.query<{
    id: number; name: string; description: string | null;
    price_monthly: number; price_yearly: number;
    stripe_price_id_monthly: string | null; stripe_price_id_yearly: string | null;
  }>(`SELECT id, name, description, price_monthly, price_yearly,
             stripe_price_id_monthly, stripe_price_id_yearly
      FROM plans WHERE is_active = true ORDER BY id`);

  console.log(`Found ${plans.length} active plans.\n`);

  // Stripe unit_amount max is 99999999 cents ($999,999.99)
  const STRIPE_MAX_CENTS = 99_999_999;

  for (const plan of plans) {
    console.log(`Processing plan: ${plan.name} (id=${plan.id})`);

    const monthlyAmountCents = Math.round(plan.price_monthly * 100);
    const yearlyAmountCents = Math.round(plan.price_yearly * 12 * 100);

    const hasValidMonthly = plan.price_monthly > 0 && monthlyAmountCents <= STRIPE_MAX_CENTS;
    const hasValidYearly = plan.price_yearly > 0 && yearlyAmountCents <= STRIPE_MAX_CENTS;

    if (!hasValidMonthly && !hasValidYearly) {
      console.log(`  ⚠ Skipped — no valid pricing (Enterprise/contact-sales plan)\n`);
      continue;
    }

    // Find or create product
    const existing = await stripe.products.search({
      query: `metadata['planId']:'${plan.id}'`,
      limit: 1,
    });

    let productId: string;
    if (existing.data[0]) {
      productId = existing.data[0].id;
      console.log(`  ✓ Existing product: ${productId}`);
    } else {
      const product = await stripe.products.create({
        name: `${plan.name} Plan`,
        description: plan.description ?? undefined,
        metadata: { planId: String(plan.id) },
      });
      productId = product.id;
      console.log(`  + Created product: ${productId}`);
    }

    // Monthly price
    let monthlyPriceId = plan.stripe_price_id_monthly;
    if (!monthlyPriceId && hasValidMonthly) {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: monthlyAmountCents,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { planId: String(plan.id), billingCycle: "monthly" },
      });
      monthlyPriceId = price.id;
      console.log(`  + Monthly price: ${monthlyPriceId} ($${plan.price_monthly}/mo)`);
    } else if (monthlyPriceId) {
      console.log(`  ✓ Monthly price already set: ${monthlyPriceId}`);
    } else {
      console.log(`  ⚠ Monthly price skipped (invalid amount)`);
    }

    // Yearly price
    let yearlyPriceId = plan.stripe_price_id_yearly;
    if (!yearlyPriceId && hasValidYearly) {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: yearlyAmountCents,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { planId: String(plan.id), billingCycle: "yearly" },
      });
      yearlyPriceId = price.id;
      console.log(`  + Yearly price: ${yearlyPriceId} ($${plan.price_yearly * 12}/yr)`);
    } else if (yearlyPriceId) {
      console.log(`  ✓ Yearly price already set: ${yearlyPriceId}`);
    } else {
      console.log(`  ⚠ Yearly price skipped (invalid amount)`);
    }

    // Write back to DB only if we have at least one price
    if (monthlyPriceId || yearlyPriceId) {
      await client.query(
        `UPDATE plans SET stripe_price_id_monthly = $1, stripe_price_id_yearly = $2,
         updated_at = NOW() WHERE id = $3`,
        [monthlyPriceId ?? null, yearlyPriceId ?? null, plan.id],
      );
      console.log(`  ✓ DB updated\n`);
    }
  }

  await client.end();
  console.log("✅ Stripe seeding complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
