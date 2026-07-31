-- Align legacy ai_credits / image_credits / audit_credits columns with credit_allocations.
-- Safe to run multiple times after admin edits plans.
-- Also included in scripts/sql/production-data-migration.sql (production sync).

UPDATE plans SET
  audit_credits = COALESCE((credit_allocations->>'audit')::int, 0) + COALESCE((credit_allocations->>'competitors')::int, 0),
  ai_credits = COALESCE((credit_allocations->>'content')::int, 0) + COALESCE((credit_allocations->>'ebc')::int, 0),
  image_credits = COALESCE((credit_allocations->>'images')::int, 0)
WHERE credit_allocations IS NOT NULL AND credit_allocations::text <> '{}';
