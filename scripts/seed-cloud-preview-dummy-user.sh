#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://lauser:lapass@127.0.0.1:5432/listingauditor}"
DUMMY_ID="${CLOUD_PREVIEW_DUMMY_USER_ID:-user_cloudpreview_demo_customer}"
LOGIN_EMAIL="demo.customer@cloud-preview.local"

echo "==> Seeding cloud preview dummy customer ($DUMMY_ID)"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO user_profiles (
  user_id,
  full_name,
  company_name,
  login_email,
  onboarding_completed,
  is_deleted,
  created_at,
  updated_at
)
VALUES (
  '$DUMMY_ID',
  'Demo Customer',
  'Cloud Preview Co.',
  '$LOGIN_EMAIL',
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  company_name = EXCLUDED.company_name,
  login_email = COALESCE(user_profiles.login_email, EXCLUDED.login_email),
  onboarding_completed = true,
  is_deleted = 0,
  updated_at = NOW();

INSERT INTO credits (user_id, ai_credits, image_credits, audit_credits, updated_at)
VALUES ('$DUMMY_ID', 50, 50, 25, NOW())
ON CONFLICT (user_id) DO UPDATE SET
  ai_credits = GREATEST(credits.ai_credits, 50),
  image_credits = GREATEST(credits.image_credits, 50),
  audit_credits = GREATEST(credits.audit_credits, 25),
  updated_at = NOW();
SQL

echo "==> Cloud preview dummy customer ready"
