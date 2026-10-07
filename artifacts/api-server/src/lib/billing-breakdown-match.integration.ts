import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { aggregateUsage, spentForFeatureTypes, type CreditUsageTx } from "./credit-usage-net.js";
import { loadCreditUsageTransactions } from "./credit-usage-scope.js";

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("billing-breakdown-match: skip (no DATABASE_URL)");
    return;
  }

  const suffix = `bd-${Date.now()}`;
  const ownerId = `owner_${suffix}`;

  const [workspace] = rowsOf<{ id: number }>(await db.execute(sql`
    insert into workspaces (account_owner_id, name, is_default, is_deleted, created_at, updated_at)
    values (${ownerId}, ${`Arka ${suffix}`}, false, 0, now(), now())
    returning id
  `));
  assert.ok(workspace);

  await db.execute(sql`
    insert into credit_transactions (
      user_id, credit_type, amount, reason, feature_type, workspace_id, created_at
    )
    values (
      ${ownerId}, 'audit', -1, 'listing audit', 'audit', ${workspace.id}, ${new Date("2026-09-01T12:00:00.000Z")}
    )
  `);

  try {
    const rows = await loadCreditUsageTransactions(ownerId, "workspace", workspace.id);
    const usage = aggregateUsage(rows as CreditUsageTx[]);
    const auditSpent = spentForFeatureTypes(usage.spentByFeatureType, ["audit", "competitors"]);
    assert.equal(usage.totalSpent, 1);
    assert.equal(auditSpent, 1);
    assert.equal(auditSpent, usage.totalSpent);
    console.log("billing-breakdown-match: total 1 appears in audit breakdown");
  } finally {
    await db.execute(sql`delete from credit_transactions where user_id = ${ownerId}`);
    await db.execute(sql`delete from workspaces where id = ${workspace.id}`);
  }
}

run()
  .then(() => {
    console.log("billing-breakdown-match: ok");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
