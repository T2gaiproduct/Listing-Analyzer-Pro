-- AUTO-GENERATED additive schema from local PostgreSQL.
-- Do not edit by hand — regenerate with:
--   bash scripts/generate-additive-schema-from-local.sh
--
-- SAFE: CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- Does not drop columns or tables.
BEGIN;

-- Tables
CREATE TABLE IF NOT EXISTS "admin_invites" (
  "id" serial,
  "email" text NOT NULL,
  "role_id" integer NOT NULL,
  "invite_token" text,
  "invited_by_user_id" text,
  "accepted_at" timestamp,
  "accepted_user_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_roles" (
  "id" serial,
  "name" text NOT NULL,
  "description" text,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" serial,
  "user_id" text NOT NULL,
  "role_id" integer NOT NULL,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ads_projects" (
  "id" serial,
  "user_id" text NOT NULL,
  "team_id" text,
  "audit_id" integer,
  "name" text DEFAULT 'Untitled Campaign'::text NOT NULL,
  "product_name" text NOT NULL,
  "category" text,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "platform" text DEFAULT 'amazon'::text NOT NULL,
  "budget" integer,
  "spend" integer DEFAULT 0 NOT NULL,
  "impressions" integer DEFAULT 0 NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "conversions" integer DEFAULT 0 NOT NULL,
  "targeting" jsonb,
  "creative_urls" jsonb,
  "error_message" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "workspace_id" integer,
  "asin" text,
  "current_step" integer DEFAULT 1 NOT NULL,
  "amazon_profile_id" text,
  "amazon_campaign_id" text,
  "amazon_ad_group_id" text,
  "daily_budget_cents" integer,
  "keyword_data" jsonb,
  "sources_snapshot" jsonb
);

CREATE TABLE IF NOT EXISTS "amazon_publish_jobs" (
  "id" serial,
  "audit_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "marketplace" text NOT NULL,
  "sku" text NOT NULL,
  "status" text NOT NULL,
  "response" jsonb,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "amazon_seller_connections" (
  "id" serial,
  "user_id" text NOT NULL,
  "seller_id" text NOT NULL,
  "refresh_token" text NOT NULL,
  "marketplace_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "connected_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial,
  "admin_user_id" text NOT NULL,
  "action" text NOT NULL,
  "entity" text NOT NULL,
  "entity_id" text,
  "metadata" jsonb,
  "ip_address" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audits" (
  "id" serial,
  "user_id" text DEFAULT ''::text NOT NULL,
  "project_name" text,
  "product_name" text NOT NULL,
  "asin" text,
  "brand_name" text,
  "category" text,
  "title" text NOT NULL,
  "bullet_points" jsonb NOT NULL,
  "image_urls" jsonb NOT NULL,
  "target_keywords" jsonb NOT NULL,
  "overall_score" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "result" jsonb,
  "generated_content" jsonb,
  "generated_images" jsonb,
  "image_records" jsonb,
  "current_step" integer DEFAULT 1,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "workspace_id" integer,
  "created_by_user_id" text,
  "store_description_html" text,
  "source_listing_content" jsonb
);

CREATE TABLE IF NOT EXISTS "blog_posts" (
  "id" serial,
  "title" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "excerpt" text,
  "content" text,
  "featured_image" varchar(500),
  "status" varchar(20) DEFAULT 'draft'::character varying NOT NULL,
  "published_at" timestamp,
  "scheduled_at" timestamp,
  "seo_title" varchar(255),
  "seo_description" text,
  "tags" _text[] DEFAULT '{}'::text[],
  "category" varchar(100),
  "author" varchar(100),
  "read_minutes" integer DEFAULT 5,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cms_content" (
  "id" serial,
  "page_slug" varchar(100) NOT NULL,
  "section_key" varchar(100) NOT NULL,
  "field_key" varchar(100) NOT NULL,
  "value" text,
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "cms_pages" (
  "id" serial,
  "title" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "description" text,
  "status" varchar(20) DEFAULT 'draft'::character varying NOT NULL,
  "published_at" timestamp,
  "scheduled_at" timestamp,
  "seo_title" varchar(255),
  "seo_description" text,
  "is_system" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "competitors" (
  "id" serial,
  "audit_id" integer NOT NULL,
  "product_name" text NOT NULL,
  "asin" text,
  "title" text NOT NULL,
  "bullet_points" jsonb NOT NULL,
  "image_count" integer DEFAULT 0 NOT NULL,
  "target_keywords" jsonb NOT NULL,
  "overall_score" integer DEFAULT 0 NOT NULL,
  "strengths" jsonb NOT NULL,
  "weaknesses" jsonb,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "coupons" (
  "id" serial,
  "code" text NOT NULL,
  "description" text,
  "discount_percent" integer,
  "discount_amount" real,
  "max_uses" integer DEFAULT 1 NOT NULL,
  "used_count" integer DEFAULT 0 NOT NULL,
  "expiry_date" timestamp,
  "is_active" boolean DEFAULT true NOT NULL,
  "applies_to" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "credit_packs" (
  "id" serial,
  "credit_type" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "price_cents" integer DEFAULT 0 NOT NULL,
  "label" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "credit_rules" (
  "id" serial,
  "activity_name" text NOT NULL,
  "feature_type" text NOT NULL,
  "credit_type" text DEFAULT 'audit'::text NOT NULL,
  "credits_required" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "credit_transactions" (
  "id" serial,
  "user_id" text NOT NULL,
  "credit_type" text NOT NULL,
  "amount" integer NOT NULL,
  "reason" text,
  "feature_type" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "workspace_id" integer
);

CREATE TABLE IF NOT EXISTS "credits" (
  "id" serial,
  "user_id" text NOT NULL,
  "ai_credits" integer DEFAULT 0 NOT NULL,
  "image_credits" integer DEFAULT 0 NOT NULL,
  "audit_credits" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "downloads" (
  "id" serial,
  "user_id" text NOT NULL,
  "audit_id" integer,
  "type" text NOT NULL,
  "filename" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "faqs" (
  "id" serial,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "category" varchar(100),
  "is_published" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "form_submissions" (
  "id" serial,
  "form_type" varchar(50) NOT NULL,
  "email" varchar(255),
  "name" varchar(100),
  "data" jsonb,
  "is_read" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "graphics_projects" (
  "id" serial,
  "user_id" text NOT NULL,
  "team_id" text,
  "audit_id" integer,
  "name" text DEFAULT 'Untitled Project'::text NOT NULL,
  "product_name" text NOT NULL,
  "category" text,
  "source_image_urls" _text[],
  "status" text DEFAULT 'draft'::text NOT NULL,
  "lifestyle_count" integer DEFAULT 0 NOT NULL,
  "feature_count" integer DEFAULT 0 NOT NULL,
  "image_records" jsonb,
  "generated_count" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "workspace_id" integer
);

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" serial,
  "user_id" text NOT NULL,
  "amount" real NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "status" text DEFAULT 'unpaid'::text NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "coupon_code" text,
  "discount_amount" real,
  "due_date" timestamp,
  "paid_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "media_files" (
  "id" serial,
  "filename" varchar(255) NOT NULL,
  "url" varchar(1000) NOT NULL,
  "mime_type" varchar(100),
  "size" integer,
  "folder" varchar(100) DEFAULT 'general'::character varying,
  "alt" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "member_credits" (
  "id" serial,
  "member_id" integer,
  "ai_credits" integer DEFAULT 0 NOT NULL,
  "image_credits" integer DEFAULT 0 NOT NULL,
  "audit_credits" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "workspace_id" integer NOT NULL,
  "workspace_member_id" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "nav_items" (
  "id" serial,
  "label" varchar(100) NOT NULL,
  "href" varchar(500) NOT NULL,
  "location" varchar(20) DEFAULT 'header'::character varying NOT NULL,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "is_cta" boolean DEFAULT false,
  "opens_new_tab" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" serial,
  "user_id" text,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "link" text,
  "read" boolean DEFAULT false NOT NULL,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "read_at" timestamp
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" serial,
  "user_id" text NOT NULL,
  "plan_id" integer,
  "amount" real NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "gateway" text NOT NULL,
  "gateway_payment_id" text,
  "invoice_id" integer,
  "coupon_code" text,
  "discount_amount" real,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pinned_projects" (
  "id" serial,
  "user_id" text NOT NULL,
  "item_type" text NOT NULL,
  "item_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "workspace_id" integer
);

CREATE TABLE IF NOT EXISTS "plans" (
  "id" serial,
  "name" text NOT NULL,
  "description" text,
  "price_monthly" integer DEFAULT 0 NOT NULL,
  "price_yearly" integer DEFAULT 0 NOT NULL,
  "ai_credits" integer DEFAULT 0 NOT NULL,
  "image_credits" integer DEFAULT 0 NOT NULL,
  "audit_credits" integer DEFAULT 0 NOT NULL,
  "team_members" integer DEFAULT 1 NOT NULL,
  "credit_allocations" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "features" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "excluded_features" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_trial" boolean DEFAULT false NOT NULL,
  "trial_days" integer DEFAULT 0 NOT NULL,
  "tag" varchar(50),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_highlighted" boolean DEFAULT false NOT NULL,
  "cta_text" varchar(100),
  "stripe_price_id_monthly" text,
  "stripe_price_id_yearly" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "enabled_features" jsonb
);

CREATE TABLE IF NOT EXISTS "product_marketplace_listings" (
  "id" serial,
  "audit_id" integer NOT NULL,
  "workspace_id" integer,
  "marketplace" text NOT NULL,
  "status" text NOT NULL,
  "sku" text,
  "price_cents" integer,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "inventory" integer,
  "published_at" timestamp,
  "listing_url" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "product_orders" (
  "id" serial,
  "audit_id" integer NOT NULL,
  "workspace_id" integer,
  "order_number" text NOT NULL,
  "marketplace" text NOT NULL,
  "customer_name" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "status" text NOT NULL,
  "ordered_at" timestamp NOT NULL,
  "tracking_number" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "product_profiles" (
  "audit_id" integer NOT NULL,
  "sku" text NOT NULL,
  "priority" text DEFAULT 'medium'::text NOT NULL,
  "assigned_manager" text,
  "reference_links" text,
  "drive_folder_url" text,
  "workflow_template" text NOT NULL,
  "target_marketplaces" jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "refunds" (
  "id" serial,
  "payment_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "amount" real NOT NULL,
  "reason" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "sellermate_agent_tools" (
  "id" serial,
  "agent_id" integer NOT NULL,
  "workspace_id" integer NOT NULL,
  "tool_name" text NOT NULL,
  "enabled" integer DEFAULT 1 NOT NULL,
  "requires_approval" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sellermate_agents" (
  "id" serial,
  "workspace_id" integer,
  "user_id" text,
  "slug" text,
  "name" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "system_prompt" text NOT NULL,
  "icon" text DEFAULT 'sparkles'::text NOT NULL,
  "model" text DEFAULT 'gpt-5.4'::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "execution_provider" text DEFAULT 'native'::text NOT NULL,
  "make_agent_id" text,
  "is_default" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "is_deleted" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "sellermate_memory" (
  "id" serial,
  "agent_id" integer NOT NULL,
  "workspace_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "memory_key" text,
  "memory_type" text DEFAULT 'file'::text NOT NULL,
  "content" text NOT NULL,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sellermate_messages" (
  "id" serial,
  "thread_id" integer NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "metadata" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sellermate_threads" (
  "id" serial,
  "agent_id" integer NOT NULL,
  "workspace_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "title" text DEFAULT 'New chat'::text NOT NULL,
  "external_conversation_id" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "last_message_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "seo_settings" (
  "id" serial,
  "page_slug" varchar(100) NOT NULL,
  "meta_title" varchar(255),
  "meta_description" text,
  "keywords" text,
  "og_title" varchar(255),
  "og_description" text,
  "og_image" varchar(500),
  "schema_markup" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
  "id" serial,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "category" text DEFAULT 'general'::text NOT NULL,
  "is_secret" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" serial,
  "user_id" text NOT NULL,
  "plan_id" integer,
  "billing_cycle" varchar(10) DEFAULT 'monthly'::character varying NOT NULL,
  "status" varchar(20) DEFAULT 'trial'::character varying NOT NULL,
  "trial_ends_at" timestamp,
  "current_period_start" timestamp,
  "current_period_end" timestamp,
  "card_last4" varchar(4),
  "card_brand" varchar(20),
  "auto_renew" boolean DEFAULT true NOT NULL,
  "coupon_code" varchar(50),
  "discount_amount" integer DEFAULT 0 NOT NULL,
  "stripe_subscription_id" text,
  "stripe_checkout_session_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "team_members" (
  "id" serial,
  "owner_user_id" text NOT NULL,
  "member_user_id" text,
  "invited_email" text NOT NULL,
  "invited_name" varchar(200) NOT NULL,
  "role" text DEFAULT 'editor'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "invite_token" text NOT NULL,
  "invited_at" timestamp DEFAULT now() NOT NULL,
  "accepted_at" timestamp,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "role_id" integer
);

CREATE TABLE IF NOT EXISTS "testimonials" (
  "id" serial,
  "name" varchar(100) NOT NULL,
  "role" varchar(100),
  "company" varchar(100),
  "avatar" varchar(500),
  "content" text NOT NULL,
  "rating" integer DEFAULT 5,
  "is_published" boolean DEFAULT true,
  "is_video" boolean DEFAULT false,
  "video_url" varchar(500),
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" serial,
  "user_id" text NOT NULL,
  "full_name" varchar(200),
  "company_name" varchar(200),
  "phone" varchar(50),
  "country" varchar(100),
  "gst_number" varchar(50),
  "website_url" varchar(500),
  "team_size" integer,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "stripe_customer_id" text,
  "avatar_url" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "login_email" varchar(255),
  "notification_preferences" jsonb
);

CREATE TABLE IF NOT EXISTS "videos_projects" (
  "id" serial,
  "user_id" text NOT NULL,
  "team_id" text,
  "audit_id" integer,
  "name" text DEFAULT 'Untitled Video'::text NOT NULL,
  "product_name" text NOT NULL,
  "category" text,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "video_url" text,
  "thumbnail_url" text,
  "duration" integer,
  "script" text,
  "style" text,
  "error_message" text,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "workspace_id" integer
);

CREATE TABLE IF NOT EXISTS "workspace_credits" (
  "id" serial,
  "workspace_id" integer NOT NULL,
  "ai_credits" integer DEFAULT 0 NOT NULL,
  "image_credits" integer DEFAULT 0 NOT NULL,
  "audit_credits" integer DEFAULT 0 NOT NULL,
  "pool_is_net" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id" serial,
  "workspace_id" integer NOT NULL,
  "user_id" text,
  "invited_email" text NOT NULL,
  "invited_name" text DEFAULT ''::text NOT NULL,
  "role_id" integer,
  "legacy_role" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "invite_token" text NOT NULL,
  "invited_at" timestamp DEFAULT now() NOT NULL,
  "accepted_at" timestamp,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "workspace_roles" (
  "id" serial,
  "account_owner_id" text,
  "workspace_id" integer,
  "name" text NOT NULL,
  "description" text,
  "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "legacy_role_key" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" serial,
  "account_owner_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "client_label" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "preserve_legacy_permissions" boolean DEFAULT true NOT NULL,
  "is_deleted" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Columns (existing tables)
ALTER TABLE "admin_invites" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "admin_invites" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "admin_invites" ADD COLUMN IF NOT EXISTS "role_id" integer;
ALTER TABLE "admin_invites" ADD COLUMN IF NOT EXISTS "invite_token" text;
ALTER TABLE "admin_invites" ADD COLUMN IF NOT EXISTS "invited_by_user_id" text;
ALTER TABLE "admin_invites" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp;
ALTER TABLE "admin_invites" ADD COLUMN IF NOT EXISTS "accepted_user_id" text;
ALTER TABLE "admin_invites" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "permissions" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "admin_roles" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "role_id" integer;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "team_id" text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "audit_id" integer;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "name" text DEFAULT 'Untitled Campaign'::text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "product_name" text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft'::text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "platform" text DEFAULT 'amazon'::text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "budget" integer;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "spend" integer DEFAULT 0;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "impressions" integer DEFAULT 0;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "clicks" integer DEFAULT 0;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "conversions" integer DEFAULT 0;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "targeting" jsonb;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "creative_urls" jsonb;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "asin" text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "current_step" integer DEFAULT 1;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "amazon_profile_id" text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "amazon_campaign_id" text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "amazon_ad_group_id" text;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "daily_budget_cents" integer;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "keyword_data" jsonb;
ALTER TABLE "ads_projects" ADD COLUMN IF NOT EXISTS "sources_snapshot" jsonb;

ALTER TABLE "amazon_publish_jobs" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "amazon_publish_jobs" ADD COLUMN IF NOT EXISTS "audit_id" integer;
ALTER TABLE "amazon_publish_jobs" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "amazon_publish_jobs" ADD COLUMN IF NOT EXISTS "marketplace" text;
ALTER TABLE "amazon_publish_jobs" ADD COLUMN IF NOT EXISTS "sku" text;
ALTER TABLE "amazon_publish_jobs" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE "amazon_publish_jobs" ADD COLUMN IF NOT EXISTS "response" jsonb;
ALTER TABLE "amazon_publish_jobs" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE "amazon_publish_jobs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "amazon_seller_connections" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "amazon_seller_connections" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "amazon_seller_connections" ADD COLUMN IF NOT EXISTS "seller_id" text;
ALTER TABLE "amazon_seller_connections" ADD COLUMN IF NOT EXISTS "refresh_token" text;
ALTER TABLE "amazon_seller_connections" ADD COLUMN IF NOT EXISTS "marketplace_ids" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "amazon_seller_connections" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "amazon_seller_connections" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "amazon_seller_connections" ADD COLUMN IF NOT EXISTS "connected_at" timestamp DEFAULT now();
ALTER TABLE "amazon_seller_connections" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "admin_user_id" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "action" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entity" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entity_id" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ip_address" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "user_id" text DEFAULT ''::text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "project_name" text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "product_name" text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "asin" text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "brand_name" text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "bullet_points" jsonb;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "image_urls" jsonb;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "target_keywords" jsonb;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "overall_score" integer DEFAULT 0;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "result" jsonb;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "generated_content" jsonb;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "generated_images" jsonb;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "image_records" jsonb;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "current_step" integer DEFAULT 1;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "created_by_user_id" text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "store_description_html" text;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "source_listing_content" jsonb;

ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "title" varchar(255);
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "slug" varchar(255);
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "excerpt" text;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "featured_image" varchar(500);
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'draft'::character varying;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "published_at" timestamp;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "seo_title" varchar(255);
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "seo_description" text;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "tags" _text[] DEFAULT '{}'::text[];
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "category" varchar(100);
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "author" varchar(100);
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "read_minutes" integer DEFAULT 5;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "cms_content" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "cms_content" ADD COLUMN IF NOT EXISTS "page_slug" varchar(100);
ALTER TABLE "cms_content" ADD COLUMN IF NOT EXISTS "section_key" varchar(100);
ALTER TABLE "cms_content" ADD COLUMN IF NOT EXISTS "field_key" varchar(100);
ALTER TABLE "cms_content" ADD COLUMN IF NOT EXISTS "value" text;
ALTER TABLE "cms_content" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "title" varchar(255);
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "slug" varchar(255);
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'draft'::character varying;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "published_at" timestamp;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "seo_title" varchar(255);
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "seo_description" text;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "is_system" boolean DEFAULT false;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "audit_id" integer;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "product_name" text;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "asin" text;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "bullet_points" jsonb;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "image_count" integer DEFAULT 0;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "target_keywords" jsonb;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "overall_score" integer DEFAULT 0;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "strengths" jsonb;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "weaknesses" jsonb;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "competitors" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "code" text;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "discount_percent" integer;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "discount_amount" real;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "max_uses" integer DEFAULT 1;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "used_count" integer DEFAULT 0;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "expiry_date" timestamp;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "applies_to" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "credit_packs" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "credit_packs" ADD COLUMN IF NOT EXISTS "credit_type" text;
ALTER TABLE "credit_packs" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1;
ALTER TABLE "credit_packs" ADD COLUMN IF NOT EXISTS "price_cents" integer DEFAULT 0;
ALTER TABLE "credit_packs" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE "credit_packs" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE "credit_packs" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "credit_packs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "credit_packs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "credit_rules" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "credit_rules" ADD COLUMN IF NOT EXISTS "activity_name" text;
ALTER TABLE "credit_rules" ADD COLUMN IF NOT EXISTS "feature_type" text;
ALTER TABLE "credit_rules" ADD COLUMN IF NOT EXISTS "credit_type" text DEFAULT 'audit'::text;
ALTER TABLE "credit_rules" ADD COLUMN IF NOT EXISTS "credits_required" integer DEFAULT 1;
ALTER TABLE "credit_rules" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "credit_rules" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE "credit_rules" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "credit_rules" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "credit_type" text;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "amount" integer;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "reason" text;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "feature_type" text;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "workspace_id" integer;

ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "ai_credits" integer DEFAULT 0;
ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "image_credits" integer DEFAULT 0;
ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "audit_credits" integer DEFAULT 0;
ALTER TABLE "credits" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "downloads" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "downloads" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "downloads" ADD COLUMN IF NOT EXISTS "audit_id" integer;
ALTER TABLE "downloads" ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE "downloads" ADD COLUMN IF NOT EXISTS "filename" text;
ALTER TABLE "downloads" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "question" text;
ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "answer" text;
ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "category" varchar(100);
ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT true;
ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "form_type" varchar(50);
ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "email" varchar(255);
ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "name" varchar(100);
ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "data" jsonb;
ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "is_read" boolean DEFAULT false;
ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "team_id" text;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "audit_id" integer;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "name" text DEFAULT 'Untitled Project'::text;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "product_name" text;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "source_image_urls" _text[];
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft'::text;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "lifestyle_count" integer DEFAULT 0;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "feature_count" integer DEFAULT 0;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "image_records" jsonb;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "generated_count" integer DEFAULT 0;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "graphics_projects" ADD COLUMN IF NOT EXISTS "workspace_id" integer;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "amount" real;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD'::text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'unpaid'::text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "items" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "coupon_code" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discount_amount" real;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "due_date" timestamp;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "filename" varchar(255);
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "url" varchar(1000);
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "mime_type" varchar(100);
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "size" integer;
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "folder" varchar(100) DEFAULT 'general'::character varying;
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "alt" varchar(255);
ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "member_credits" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "member_credits" ADD COLUMN IF NOT EXISTS "member_id" integer;
ALTER TABLE "member_credits" ADD COLUMN IF NOT EXISTS "ai_credits" integer DEFAULT 0;
ALTER TABLE "member_credits" ADD COLUMN IF NOT EXISTS "image_credits" integer DEFAULT 0;
ALTER TABLE "member_credits" ADD COLUMN IF NOT EXISTS "audit_credits" integer DEFAULT 0;
ALTER TABLE "member_credits" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "member_credits" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "member_credits" ADD COLUMN IF NOT EXISTS "workspace_member_id" integer;

ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "label" varchar(100);
ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "href" varchar(500);
ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "location" varchar(20) DEFAULT 'header'::character varying;
ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "is_cta" boolean DEFAULT false;
ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "opens_new_tab" boolean DEFAULT false;
ALTER TABLE "nav_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "link" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read" boolean DEFAULT false;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "sent_at" timestamp DEFAULT now();
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read_at" timestamp;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "plan_id" integer;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amount" real;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD'::text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gateway" text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gateway_payment_id" text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "invoice_id" integer;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "coupon_code" text;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "discount_amount" real;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "pinned_projects" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "pinned_projects" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "pinned_projects" ADD COLUMN IF NOT EXISTS "item_type" text;
ALTER TABLE "pinned_projects" ADD COLUMN IF NOT EXISTS "item_id" integer;
ALTER TABLE "pinned_projects" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "pinned_projects" ADD COLUMN IF NOT EXISTS "workspace_id" integer;

ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "price_monthly" integer DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "price_yearly" integer DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "ai_credits" integer DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "image_credits" integer DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "audit_credits" integer DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "team_members" integer DEFAULT 1;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "credit_allocations" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "features" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "excluded_features" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "is_trial" boolean DEFAULT false;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "trial_days" integer DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "tag" varchar(50);
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "is_highlighted" boolean DEFAULT false;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "cta_text" varchar(100);
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_price_id_monthly" text;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_price_id_yearly" text;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "enabled_features" jsonb;

ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "audit_id" integer;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "marketplace" text;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "sku" text;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "price_cents" integer;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD'::text;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "inventory" integer;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "published_at" timestamp;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "listing_url" text;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "product_marketplace_listings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "audit_id" integer;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "order_number" text;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "marketplace" text;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "customer_name" text;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "amount_cents" integer;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD'::text;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "ordered_at" timestamp;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "tracking_number" text;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "product_profiles" ADD COLUMN IF NOT EXISTS "audit_id" integer;
ALTER TABLE "product_profiles" ADD COLUMN IF NOT EXISTS "sku" text;
ALTER TABLE "product_profiles" ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'medium'::text;
ALTER TABLE "product_profiles" ADD COLUMN IF NOT EXISTS "assigned_manager" text;
ALTER TABLE "product_profiles" ADD COLUMN IF NOT EXISTS "reference_links" text;
ALTER TABLE "product_profiles" ADD COLUMN IF NOT EXISTS "drive_folder_url" text;
ALTER TABLE "product_profiles" ADD COLUMN IF NOT EXISTS "workflow_template" text;
ALTER TABLE "product_profiles" ADD COLUMN IF NOT EXISTS "target_marketplaces" jsonb DEFAULT '[]'::jsonb;

ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "payment_id" integer;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "amount" real;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "reason" text;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "processed_at" timestamp;

ALTER TABLE "sellermate_agent_tools" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "sellermate_agent_tools" ADD COLUMN IF NOT EXISTS "agent_id" integer;
ALTER TABLE "sellermate_agent_tools" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "sellermate_agent_tools" ADD COLUMN IF NOT EXISTS "tool_name" text;
ALTER TABLE "sellermate_agent_tools" ADD COLUMN IF NOT EXISTS "enabled" integer DEFAULT 1;
ALTER TABLE "sellermate_agent_tools" ADD COLUMN IF NOT EXISTS "requires_approval" integer DEFAULT 0;
ALTER TABLE "sellermate_agent_tools" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "description" text DEFAULT ''::text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "system_prompt" text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "icon" text DEFAULT 'sparkles'::text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "model" text DEFAULT 'gpt-5.4'::text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active'::text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "execution_provider" text DEFAULT 'native'::text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "make_agent_id" text;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "is_default" integer DEFAULT 0;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "sellermate_agents" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;

ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "agent_id" integer;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "description" text DEFAULT ''::text;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "memory_key" text;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "memory_type" text DEFAULT 'file'::text;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "sellermate_memory" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "sellermate_messages" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "sellermate_messages" ADD COLUMN IF NOT EXISTS "thread_id" integer;
ALTER TABLE "sellermate_messages" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "sellermate_messages" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE "sellermate_messages" ADD COLUMN IF NOT EXISTS "metadata" text;
ALTER TABLE "sellermate_messages" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "sellermate_messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "sellermate_messages" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();

ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "agent_id" integer;
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "title" text DEFAULT 'New chat'::text;
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "external_conversation_id" text;
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "last_message_at" timestamp;
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "sellermate_threads" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "page_slug" varchar(100);
ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "meta_title" varchar(255);
ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "meta_description" text;
ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "keywords" text;
ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "og_title" varchar(255);
ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "og_description" text;
ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "og_image" varchar(500);
ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "schema_markup" text;
ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "key" text;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "value" text;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'general'::text;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "is_secret" boolean DEFAULT false;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "plan_id" integer;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billing_cycle" varchar(10) DEFAULT 'monthly'::character varying;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'trial'::character varying;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "card_last4" varchar(4);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "card_brand" varchar(20);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "auto_renew" boolean DEFAULT true;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "coupon_code" varchar(50);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "discount_amount" integer DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "owner_user_id" text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "member_user_id" text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "invited_email" text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "invited_name" varchar(200);
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'editor'::text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "invite_token" text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "invited_at" timestamp DEFAULT now();
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "role_id" integer;

ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "name" varchar(100);
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "role" varchar(100);
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "company" varchar(100);
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "avatar" varchar(500);
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "rating" integer DEFAULT 5;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT true;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "is_video" boolean DEFAULT false;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "video_url" varchar(500);
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "full_name" varchar(200);
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "company_name" varchar(200);
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "phone" varchar(50);
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "country" varchar(100);
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "gst_number" varchar(50);
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "website_url" varchar(500);
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "team_size" integer;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "login_email" varchar(255);
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb;

ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "team_id" text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "audit_id" integer;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "name" text DEFAULT 'Untitled Video'::text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "product_name" text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft'::text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "duration" integer;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "script" text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "style" text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "videos_projects" ADD COLUMN IF NOT EXISTS "workspace_id" integer;

ALTER TABLE "workspace_credits" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "workspace_credits" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "workspace_credits" ADD COLUMN IF NOT EXISTS "ai_credits" integer DEFAULT 0;
ALTER TABLE "workspace_credits" ADD COLUMN IF NOT EXISTS "image_credits" integer DEFAULT 0;
ALTER TABLE "workspace_credits" ADD COLUMN IF NOT EXISTS "audit_credits" integer DEFAULT 0;
ALTER TABLE "workspace_credits" ADD COLUMN IF NOT EXISTS "pool_is_net" boolean DEFAULT false;
ALTER TABLE "workspace_credits" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "user_id" text;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "invited_email" text;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "invited_name" text DEFAULT ''::text;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "role_id" integer;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "legacy_role" text;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "invite_token" text;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "invited_at" timestamp DEFAULT now();
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "account_owner_id" text;
ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "permissions" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "is_system" boolean DEFAULT false;
ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "legacy_role_key" text;
ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "workspace_roles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "id" integer;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "account_owner_id" text;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "client_label" text;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "preserve_legacy_permissions" boolean DEFAULT true;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "is_deleted" integer DEFAULT 0;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

COMMIT;
