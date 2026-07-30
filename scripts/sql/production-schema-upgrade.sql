-- Production schema upgrade for Listing Auditor / SellerLens
-- Target: databases deployed before workspace RBAC + profile login_email (main ~ PR #199–#201)
--
-- SAFE: additive only (IF NOT EXISTS). Does not drop data.
-- BACKUP production before running.
--
-- Preferred approach (from repo root on main):
--   DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run push
--
-- Use this script when:
--   - drizzle push cannot be run from the deploy host, or
--   - you need a reviewed, explicit SQL upgrade (e.g. login_email missing)
--
-- Apply:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/production-schema-upgrade.sql
--
-- After apply: restart the API server. Legacy workspace_id backfill runs on demand via the API.

BEGIN;

-- ─── user_profiles ───────────────────────────────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS login_email varchar(255);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb;

-- ─── team_members (custom account roles / PR #200) ─────────────────────────
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS role_id integer;

-- ─── workspace RBAC (create if missing) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id serial PRIMARY KEY,
  account_owner_id text NOT NULL,
  name text NOT NULL,
  description text,
  client_label text,
  is_default boolean NOT NULL DEFAULT false,
  preserve_legacy_permissions boolean NOT NULL DEFAULT true,
  is_deleted integer NOT NULL DEFAULT 0,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_roles (
  id serial PRIMARY KEY,
  account_owner_id text,
  workspace_id integer,
  name text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  legacy_role_key text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id serial PRIMARY KEY,
  workspace_id integer NOT NULL,
  user_id text,
  invited_email text NOT NULL,
  invited_name text NOT NULL DEFAULT '',
  role_id integer,
  legacy_role text,
  status text NOT NULL DEFAULT 'pending',
  invite_token text NOT NULL,
  invited_at timestamp NOT NULL DEFAULT now(),
  accepted_at timestamp,
  is_deleted integer NOT NULL DEFAULT 0,
  deleted_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_invite_token_unique
  ON workspace_members (invite_token);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_uniq
  ON workspace_members (workspace_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_roles_account_name_uniq
  ON workspace_roles (account_owner_id, name);

-- Account-global roles (matches artifacts/api-server/src/lib/ensure-account-roles.ts)
ALTER TABLE workspace_roles ADD COLUMN IF NOT EXISTS account_owner_id text;

ALTER TABLE workspace_roles
  ALTER COLUMN workspace_id DROP NOT NULL;

ALTER TABLE workspace_roles
  DROP CONSTRAINT IF EXISTS workspace_roles_workspace_name_uniq;

UPDATE workspace_roles wr
SET account_owner_id = w.account_owner_id
FROM workspaces w
WHERE wr.workspace_id = w.id
  AND (wr.account_owner_id IS NULL OR wr.account_owner_id = '');

-- ─── workspace scoping on project tables ───────────────────────────────────
ALTER TABLE audits ADD COLUMN IF NOT EXISTS workspace_id integer;
ALTER TABLE graphics_projects ADD COLUMN IF NOT EXISTS workspace_id integer;
ALTER TABLE videos_projects ADD COLUMN IF NOT EXISTS workspace_id integer;
ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS workspace_id integer;
ALTER TABLE pinned_projects ADD COLUMN IF NOT EXISTS workspace_id integer;

-- ─── workspace-scoped credits (two-level: account → workspace pool → members) ─
CREATE TABLE IF NOT EXISTS workspace_credits (
  id serial PRIMARY KEY,
  workspace_id integer NOT NULL UNIQUE,
  ai_credits integer NOT NULL DEFAULT 0,
  image_credits integer NOT NULL DEFAULT 0,
  audit_credits integer NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE member_credits ADD COLUMN IF NOT EXISTS workspace_id integer;
ALTER TABLE member_credits ADD COLUMN IF NOT EXISTS workspace_member_id integer;
ALTER TABLE member_credits ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS workspace_id integer;
DROP INDEX IF EXISTS member_credits_member_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS member_credits_workspace_member_uniq
  ON member_credits (workspace_member_id)
  WHERE workspace_member_id IS NOT NULL;

COMMIT;

-- Verification (run manually after COMMIT):
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'user_profiles' AND column_name IN ('login_email', 'notification_preferences');
--   SELECT to_regclass('public.workspace_members'), to_regclass('public.workspaces');
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'team_members' AND column_name = 'role_id';
