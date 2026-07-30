import { eq, and, sql } from "drizzle-orm";
import { db, memberCreditsTable, workspacesTable, workspaceMembersTable } from "@workspace/db";
import { ensureWorkspaceCreditsRow } from "./workspace-credits.js";

let migrated = false;

/** Schema + one-time data migration for workspace-scoped credits. */
export async function ensureWorkspaceCreditsMigrated(): Promise<void> {
  if (migrated) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS workspace_credits (
      id serial PRIMARY KEY,
      workspace_id integer NOT NULL UNIQUE,
      ai_credits integer NOT NULL DEFAULT 0,
      image_credits integer NOT NULL DEFAULT 0,
      audit_credits integer NOT NULL DEFAULT 0,
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`ALTER TABLE member_credits ADD COLUMN IF NOT EXISTS workspace_id integer`);
  await db.execute(sql`ALTER TABLE member_credits ADD COLUMN IF NOT EXISTS workspace_member_id integer`);
  await db.execute(sql`ALTER TABLE member_credits ALTER COLUMN member_id DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS workspace_id integer`);
  await db.execute(sql`ALTER TABLE member_credits DROP CONSTRAINT IF EXISTS member_credits_member_id_unique`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS member_credits_workspace_member_uniq
      ON member_credits (workspace_member_id)
      WHERE workspace_member_id IS NOT NULL
  `);

  const legacy = await db.execute(sql`
    SELECT mc.id, mc.member_id, mc.ai_credits, mc.image_credits, mc.audit_credits,
           tm.owner_user_id, tm.member_user_id, tm.invited_email
    FROM member_credits mc
    INNER JOIN team_members tm ON tm.id = mc.member_id
    WHERE mc.workspace_member_id IS NULL
  `);

  for (const row of legacy.rows as Array<{
    id: number;
    member_id: number;
    ai_credits: number;
    image_credits: number;
    audit_credits: number;
    owner_user_id: string;
    member_user_id: string | null;
    invited_email: string;
  }>) {
    const owned = await db
      .select({ id: workspacesTable.id })
      .from(workspacesTable)
      .where(and(
        eq(workspacesTable.accountOwnerId, row.owner_user_id),
        eq(workspacesTable.isDeleted, 0),
      ))
      .orderBy(workspacesTable.isDefault);

    const workspaceId = owned.find((w) => w.id)?.id ?? owned[0]?.id;
    if (!workspaceId) continue;

    await ensureWorkspaceCreditsRow(workspaceId);

    let wmId: number | null = null;
    if (row.member_user_id) {
      const [wm] = await db
        .select({ id: workspaceMembersTable.id })
        .from(workspaceMembersTable)
        .where(and(
          eq(workspaceMembersTable.workspaceId, workspaceId),
          eq(workspaceMembersTable.userId, row.member_user_id),
          eq(workspaceMembersTable.isDeleted, 0),
        ))
        .limit(1);
      wmId = wm?.id ?? null;
    }
    if (!wmId) {
      const emailLower = row.invited_email.trim().toLowerCase();
      const members = await db
        .select({ id: workspaceMembersTable.id, email: workspaceMembersTable.invitedEmail })
        .from(workspaceMembersTable)
        .where(and(
          eq(workspaceMembersTable.workspaceId, workspaceId),
          eq(workspaceMembersTable.isDeleted, 0),
        ));
      const match = members.find((m) => m.email.trim().toLowerCase() === emailLower);
      wmId = match?.id ?? null;
    }
    if (!wmId) continue;

    await db.execute(sql`
      UPDATE member_credits
      SET workspace_id = ${workspaceId},
          workspace_member_id = ${wmId}
      WHERE id = ${row.id}
    `);
  }

  const allWorkspaces = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.isDeleted, 0));

  for (const ws of allWorkspaces) {
    await ensureWorkspaceCreditsRow(ws.id);
  }

  migrated = true;
}
