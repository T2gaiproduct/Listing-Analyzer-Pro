import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sumCreditsUsedForWorkspace, sumCreditsUsedInWorkspaceForUser } from "./team-stats.js";
import { workspaceFundedPoolTotal } from "./workspace-credits.js";

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

async function tableExists(name: string): Promise<boolean> {
  const result = await db.execute(sql`
    select 1 as ok
    from information_schema.tables
    where table_schema = 'public' and table_name = ${name}
    limit 1
  `);
  return rowsOf<{ ok: number }>(result).length > 0;
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("workspace-usage-all-time: skip (no DATABASE_URL)");
    return;
  }
  if (!(await tableExists("workspaces")) || !(await tableExists("credit_transactions"))) {
    console.log("workspace-usage-all-time: skip (tables missing)");
    return;
  }

  const suffix = `alltime-${Date.now()}`;
  const ownerId = `owner_${suffix}`;
  const memberUserId = `member_${suffix}`;
  const periodStart = new Date("2026-10-01T00:00:00.000Z");
  const periodEnd = new Date("2026-10-31T23:59:59.999Z");
  const septemberSpend = new Date("2026-09-26T12:00:00.000Z");
  const unassigned = { aiCredits: 100, imageCredits: 96, auditCredits: 2 };
  const memberRemaining = { aiCredits: 0, imageCredits: 0, auditCredits: 0 };

  const [workspace] = rowsOf<{ id: number }>(await db.execute(sql`
    insert into workspaces (account_owner_id, name, is_default, is_deleted, created_at, updated_at)
    values (${ownerId}, ${`Imperial ${suffix}`}, false, 0, now(), now())
    returning id
  `));
  assert.ok(workspace);

  await db.execute(sql`
    insert into workspace_credits (workspace_id, ai_credits, image_credits, audit_credits, updated_at)
    values (${workspace.id}, ${unassigned.aiCredits}, ${unassigned.imageCredits}, ${unassigned.auditCredits}, now())
  `);

  await db.execute(sql`
    insert into credit_transactions (
      user_id, credit_type, amount, reason, feature_type, workspace_id, created_at
    )
    values (
      ${ownerId},
      'ai',
      -161,
      'owner pool spend',
      'audit',
      ${workspace.id},
      ${septemberSpend}
    )
  `);

  try {
    const usedInPeriod = await sumCreditsUsedForWorkspace(workspace.id, periodStart, periodEnd);
    const usedAllTime = await sumCreditsUsedForWorkspace(workspace.id);
    const ownerUsedAllTime = await sumCreditsUsedInWorkspaceForUser(ownerId, workspace.id);
    const memberUsedAllTime = await sumCreditsUsedInWorkspaceForUser(memberUserId, workspace.id);

    assert.equal(usedInPeriod, 0, `period used should be 0, got ${usedInPeriod}`);
    assert.equal(usedAllTime, 161, `all-time used should be 161, got ${usedAllTime}`);
    assert.equal(ownerUsedAllTime, 161, `owner all-time used should be 161, got ${ownerUsedAllTime}`);
    assert.equal(memberUsedAllTime, 0, `member all-time used should be 0, got ${memberUsedAllTime}`);
    assert.equal(workspaceFundedPoolTotal(unassigned, memberRemaining, usedInPeriod), 198);
    assert.equal(workspaceFundedPoolTotal(unassigned, memberRemaining, usedAllTime), 359);
    console.log("workspace-usage-all-time: prior-period owner spend counts in Used and Funded");
  } finally {
    await db.execute(sql`delete from credit_transactions where user_id = ${ownerId}`);
    await db.execute(sql`delete from workspace_credits where workspace_id = ${workspace.id}`);
    await db.execute(sql`delete from workspaces where id = ${workspace.id}`);
  }
}

run()
  .then(() => {
    console.log("workspace-usage-all-time: ok");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
