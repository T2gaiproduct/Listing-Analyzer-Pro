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
-- After apply:
--   1. psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/production-data-migration.sql
--      (or run bash scripts/sync-production-db.sh which does schema + data + verify)
--   2. Restart the API server (ensureWorkspaceCreditsMigrated also runs on boot).

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
ALTER TABLE audits ADD COLUMN IF NOT EXISTS created_by_user_id text;
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
  pool_is_net boolean NOT NULL DEFAULT false,
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE workspace_credits ADD COLUMN IF NOT EXISTS pool_is_net boolean NOT NULL DEFAULT false;

-- ─── billing / coupons ───────────────────────────────────────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_amount real;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount real;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS coupon_code varchar(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0;

ALTER TABLE member_credits ADD COLUMN IF NOT EXISTS workspace_id integer;
ALTER TABLE member_credits ADD COLUMN IF NOT EXISTS workspace_member_id integer;
ALTER TABLE member_credits ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS workspace_id integer;
ALTER TABLE member_credits DROP CONSTRAINT IF EXISTS member_credits_member_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS member_credits_workspace_member_uniq
  ON member_credits (workspace_member_id)
  WHERE workspace_member_id IS NOT NULL;

-- ─── product_orders (marketplace order tracking per Build Your Brand product) ─
CREATE TABLE IF NOT EXISTS product_orders (
  id serial PRIMARY KEY,
  audit_id integer NOT NULL,
  workspace_id integer,
  order_number text NOT NULL,
  marketplace text NOT NULL,
  customer_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL,
  ordered_at timestamp NOT NULL,
  tracking_number text,
  is_deleted integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_orders_audit_id_idx
  ON product_orders (audit_id);

CREATE TABLE IF NOT EXISTS product_marketplace_listings (
  id serial PRIMARY KEY,
  audit_id integer NOT NULL,
  workspace_id integer,
  marketplace text NOT NULL,
  status text NOT NULL,
  sku text,
  price_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  inventory integer,
  published_at timestamp,
  listing_url text,
  is_deleted integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_marketplace_listings_audit_id_idx
  ON product_marketplace_listings (audit_id);

CREATE TABLE IF NOT EXISTS product_profiles (
  audit_id integer PRIMARY KEY,
  sku text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  assigned_manager text,
  reference_links text,
  drive_folder_url text,
  workflow_template text NOT NULL,
  target_marketplaces jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- ─── plans (admin plan capabilities — required for POST /api/admin/plans) ───
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS enabled_features jsonb;

-- ─── admin invites (pending admin access before sign-up) ───────────────────
CREATE TABLE IF NOT EXISTS admin_invites (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  role_id integer NOT NULL,
  invite_token text UNIQUE,
  invited_by_user_id text,
  accepted_at timestamp,
  accepted_user_id text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ─── Amazon SP-API integration ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amazon_seller_connections (
  id serial PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  seller_id text NOT NULL,
  refresh_token text NOT NULL,
  marketplace_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_deleted integer NOT NULL DEFAULT 0,
  deleted_at timestamp,
  connected_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS amazon_publish_jobs (
  id serial PRIMARY KEY,
  audit_id integer NOT NULL,
  user_id text NOT NULL,
  marketplace text NOT NULL,
  sku text NOT NULL,
  status text NOT NULL,
  response jsonb,
  error_message text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ─── ads + video project tables (workspace-scoped) ─────────────────────────
CREATE TABLE IF NOT EXISTS ads_projects (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  workspace_id integer,
  team_id text,
  audit_id integer,
  name text NOT NULL DEFAULT 'Untitled Campaign',
  product_name text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'draft',
  platform text NOT NULL DEFAULT 'amazon',
  budget integer,
  spend integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  targeting jsonb,
  creative_urls jsonb,
  error_message text,
  is_deleted integer NOT NULL DEFAULT 0,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS videos_projects (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  workspace_id integer,
  team_id text,
  audit_id integer,
  name text NOT NULL DEFAULT 'Untitled Video',
  product_name text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'draft',
  video_url text,
  thumbnail_url text,
  duration integer,
  script text,
  style text,
  error_message text,
  is_deleted integer NOT NULL DEFAULT 0,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS workspace_id integer;
ALTER TABLE videos_projects ADD COLUMN IF NOT EXISTS workspace_id integer;

-- Manage Ads workflow columns (align with lib/db/src/schema/ads.ts)
ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS asin text;
ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS current_step integer NOT NULL DEFAULT 1;
ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS amazon_profile_id text;
ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS amazon_campaign_id text;
ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS amazon_ad_group_id text;
ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS daily_budget_cents integer;
ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS keyword_data jsonb;
ALTER TABLE ads_projects ADD COLUMN IF NOT EXISTS sources_snapshot jsonb;

-- ─── SellerLens AI (sellermate_* tables) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS sellermate_agents (
  id serial PRIMARY KEY,
  workspace_id integer,
  user_id text,
  slug text,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  system_prompt text NOT NULL,
  icon text NOT NULL DEFAULT 'sparkles',
  model text NOT NULL DEFAULT 'gpt-5.4',
  status text NOT NULL DEFAULT 'active',
  execution_provider text NOT NULL DEFAULT 'native',
  make_agent_id text,
  is_default integer NOT NULL DEFAULT 0,
  is_deleted integer NOT NULL DEFAULT 0,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sellermate_agent_tools (
  id serial PRIMARY KEY,
  agent_id integer NOT NULL REFERENCES sellermate_agents(id) ON DELETE CASCADE,
  workspace_id integer NOT NULL,
  tool_name text NOT NULL,
  enabled integer NOT NULL DEFAULT 1,
  requires_approval integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sellermate_threads (
  id serial PRIMARY KEY,
  agent_id integer NOT NULL REFERENCES sellermate_agents(id) ON DELETE CASCADE,
  workspace_id integer NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  external_conversation_id text,
  is_deleted integer NOT NULL DEFAULT 0,
  deleted_at timestamp,
  last_message_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sellermate_messages (
  id serial PRIMARY KEY,
  thread_id integer NOT NULL REFERENCES sellermate_threads(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  is_deleted integer NOT NULL DEFAULT 0,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sellermate_memory (
  id serial PRIMARY KEY,
  agent_id integer NOT NULL REFERENCES sellermate_agents(id) ON DELETE CASCADE,
  workspace_id integer NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  memory_key text,
  memory_type text NOT NULL DEFAULT 'file',
  content text NOT NULL,
  is_deleted integer NOT NULL DEFAULT 0,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS model text DEFAULT 'gpt-5.4';
ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS execution_provider text DEFAULT 'native';
ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS make_agent_id text;
ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS memory_key text;
ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'file';
ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS external_conversation_id text;

COMMIT;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'user_profiles' AND column_name IN ('login_email', 'notification_preferences');
--   SELECT to_regclass('public.workspace_members'), to_regclass('public.workspaces');
--   SELECT to_regclass('public.workspace_credits');
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'team_members' AND column_name = 'role_id';
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'member_credits'
--       AND column_name IN ('workspace_id', 'workspace_member_id');
