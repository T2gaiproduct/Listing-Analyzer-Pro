-- Production DATA migration (run after production-schema-upgrade.sql or drizzle push)
-- Target: workspace-scoped credits (workspace pools + member_credits workspace_member_id)
--
-- SAFE: idempotent updates only. Does not delete rows.
-- BACKUP production before running.
--
-- Apply (from repo root):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/production-data-migration.sql
--
-- The API also runs equivalent logic on boot (ensureWorkspaceCreditsMigrated).
-- Use this script when you want production aligned before or without an API restart.

BEGIN;

-- Ensure every active workspace has a credit pool row (default balance 0).
INSERT INTO workspace_credits (workspace_id, ai_credits, image_credits, audit_credits)
SELECT w.id, 0, 0, 0
FROM workspaces w
WHERE w.is_deleted = 0
ON CONFLICT (workspace_id) DO NOTHING;

-- Backfill workspace_id + workspace_member_id on legacy team-scoped member_credits rows.
UPDATE member_credits mc
SET
  workspace_id = paired.workspace_id,
  workspace_member_id = paired.wm_id
FROM (
  SELECT DISTINCT ON (mc.id)
    mc.id AS mc_id,
    w.id AS workspace_id,
    wm.id AS wm_id
  FROM member_credits mc
  INNER JOIN team_members tm ON tm.id = mc.member_id
  INNER JOIN LATERAL (
    SELECT id
    FROM workspaces
    WHERE account_owner_id = tm.owner_user_id
      AND is_deleted = 0
    ORDER BY is_default DESC, id
    LIMIT 1
  ) w ON true
  INNER JOIN workspace_members wm
    ON wm.workspace_id = w.id
   AND wm.is_deleted = 0
   AND (
     tm.member_user_id IS NOT NULL AND wm.user_id = tm.member_user_id
     OR lower(trim(wm.invited_email)) = lower(trim(tm.invited_email))
   )
  WHERE mc.workspace_member_id IS NULL
    AND mc.member_id IS NOT NULL
) paired
WHERE mc.id = paired.mc_id
  AND paired.wm_id IS NOT NULL;

COMMIT;

-- Verification (run manually after COMMIT):
--   SELECT COUNT(*) FROM workspace_credits;
--   SELECT COUNT(*) FROM member_credits WHERE workspace_member_id IS NULL AND member_id IS NOT NULL;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'member_credits'
--       AND column_name IN ('workspace_id', 'workspace_member_id');
