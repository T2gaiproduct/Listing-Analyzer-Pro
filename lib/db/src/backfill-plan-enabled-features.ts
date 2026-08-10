import { eq } from "drizzle-orm";
import { defaultEnabledFeaturesForPlanName } from "@workspace/workspace-permissions";
import { db, pool, plansTable } from "./index.js";

async function backfill() {
  console.log("Backfilling plans.enabled_features…");
  const plans = await db.select().from(plansTable);
  let updated = 0;

  for (const plan of plans) {
    if (plan.enabledFeatures != null) {
      console.log(`  ⏭  "${plan.name}" — already configured`);
      continue;
    }

    const enabledFeatures = defaultEnabledFeaturesForPlanName(plan.name);
    await db
      .update(plansTable)
      .set({ enabledFeatures, updatedAt: new Date() })
      .where(eq(plansTable.id, plan.id));

    console.log(`  ✓  "${plan.name}" → ${JSON.stringify(enabledFeatures)}`);
    updated += 1;
  }

  console.log(`Done. Updated ${updated} plan(s).`);
  await pool.end();
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
