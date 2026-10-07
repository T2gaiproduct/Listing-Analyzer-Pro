import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sumCreditsUsedForWorkspace, sumCreditsUsedForWorkspaceMember } from "./team-stats.js";

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
    console.log("workspace-credit-attribution: skip (no DATABASE_URL)");
    return;
  }
  if (!(await tableExists("workspaces")) || !(await tableExists("workspace_members"))) {
    console.log("workspace-credit-attribution: skip (workspace tables missing)");
    return;
  }

  const suffix = `attr-test-${Date.now()}`;
  const ownerId = `owner_${suffix}`;
  const memberUserId = `member_${suffix}`;

  const wsRows = rowsOf<{ id: number; name: string }>(await db.execute(sql`
    insert into workspaces (account_owner_id, name, is_default, is_deleted, created_at, updated_at)
    values
      (${ownerId}, ${`Default ${suffix}`}, true, 0, now(), now()),
      (${ownerId}, ${`Arka ${suffix}`}, false, 0, now(), now())
    returning id, name
  `));

  const defaultWs = wsRows.find((w) => w.name.startsWith("Default"));
  const arkaWs = wsRows.find((w) => w.name.startsWith("Arka"));
  assert.ok(defaultWs && arkaWs);

  const [member] = rowsOf<{ id: number }>(await db.execute(sql`
    insert into workspace_members (
      workspace_id, user_id, invited_email, invited_name, status, is_deleted, invited_at, invite_token
    )
    values (
      ${arkaWs.id},
      ${memberUserId},
      ${`${suffix}@example.com`},
      'pankaj',
      'active',
      0,
      now(),
      ${randomBytes(16).toString("hex")}
    )
    returning id
  `));

  await db.execute(sql`
    insert into member_credits (
      workspace_id, workspace_member_id, ai_credits, image_credits, audit_credits, updated_at
    )
    values (${arkaWs.id}, ${member.id}, 49, 50, 50, now())
  `);

  await db.execute(sql`
    insert into credit_transactions (
      user_id, credit_type, amount, reason, feature_type, workspace_id, metadata, created_at
    )
    values (
      ${memberUserId},
      'ai',
      -1,
      'Audit',
      'audit',
      ${defaultWs.id},
      ${JSON.stringify({ chargedFrom: "workspace_member_pool", workspaceMemberId: member.id })}::jsonb,
      now()
    )
  `);

  try {
    const arkaUsed = await sumCreditsUsedForWorkspace(arkaWs.id);
    const defaultUsed = await sumCreditsUsedForWorkspace(defaultWs.id);
    const memberUsed = await sumCreditsUsedForWorkspaceMember(member.id);
    assert.equal(arkaUsed, 1, `Arka used should be 1, got ${arkaUsed}`);
    assert.equal(defaultUsed, 0, `Default used should be 0, got ${defaultUsed}`);
    assert.equal(memberUsed, 1, `Member used should be 1, got ${memberUsed}`);
    console.log("workspace-credit-attribution: mismatched workspace_id counts on member workspace");
  } finally {
    await db.execute(sql`delete from credit_transactions where user_id = ${memberUserId}`);
    await db.execute(sql`delete from member_credits where workspace_member_id = ${member.id}`);
    await db.execute(sql`delete from workspace_members where id = ${member.id}`);
    await db.execute(sql`delete from workspaces where account_owner_id = ${ownerId}`);
  }
}

run()
  .then(() => {
    console.log("workspace-credit-attribution: ok");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
