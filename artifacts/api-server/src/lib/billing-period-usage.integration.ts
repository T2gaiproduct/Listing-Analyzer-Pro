import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { aggregatePeriodUsage, type CreditUsageTx } from "./credit-usage-net.js";
import { loadCreditUsageTransactionsInPeriod } from "./credit-usage-scope.js";
import { sumCreditsUsedForWorkspace } from "./team-stats.js";

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("billing-period-usage: skip (no DATABASE_URL)");
    return;
  }

  const suffix = `period-${Date.now()}`;
  const ownerId = `owner_${suffix}`;
  const periodStart = new Date("2026-09-10T00:00:00.000Z");
  const periodEnd = new Date("2026-10-10T00:00:00.000Z");

  const [workspace] = rowsOf<{ id: number }>(await db.execute(sql`
    insert into workspaces (account_owner_id, name, is_default, is_deleted, created_at, updated_at)
    values (${ownerId}, ${`WS ${suffix}`}, false, 0, now(), now())
    returning id
  `));
  assert.ok(workspace);

  await db.execute(sql`
    insert into credit_transactions (
      user_id, credit_type, amount, reason, feature_type, workspace_id, created_at
    )
    values
      (${ownerId}, 'image', -40, 'graphics in period', 'images', ${workspace.id}, ${new Date("2026-09-26T12:00:00.000Z")}),
      (${ownerId}, 'audit', -2, 'audit in period', 'audit', ${workspace.id}, ${new Date("2026-09-27T12:00:00.000Z")}),
      (${ownerId}, 'ai', -161, 'outside period', 'content', ${workspace.id}, ${new Date("2026-08-01T12:00:00.000Z")})
  `);

  try {
    const periodRows = await loadCreditUsageTransactionsInPeriod(
      ownerId,
      "workspace",
      workspace.id,
      periodStart,
      periodEnd,
    );
    const usage = aggregatePeriodUsage(periodRows as CreditUsageTx[]);
    const teamPeriod = await sumCreditsUsedForWorkspace(workspace.id, periodStart, periodEnd);

    assert.equal(usage.totalSpent, 42, `period total should be 42, got ${usage.totalSpent}`);
    assert.equal(usage.spentByFeatureType.images, 40);
    assert.equal(usage.spentByFeatureType.audit, 2);
    assert.equal(usage.spentByFeatureType.content, undefined);
    assert.equal(teamPeriod, 42, `team period used should match breakdown total, got ${teamPeriod}`);
    console.log("billing-period-usage: workspace period total matches service breakdown");
  } finally {
    await db.execute(sql`delete from credit_transactions where user_id = ${ownerId}`);
    await db.execute(sql`delete from workspaces where id = ${workspace.id}`);
  }
}

run()
  .then(() => {
    console.log("billing-period-usage: ok");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
