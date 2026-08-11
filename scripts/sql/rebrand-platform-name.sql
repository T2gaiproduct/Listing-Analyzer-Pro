-- Normalize legacy "Listing Auditor" platform branding to Seller Lens.
-- Safe to run multiple times.

UPDATE settings
SET value = 'Seller Lens', updated_at = NOW()
WHERE key = 'platform_name'
  AND (
    value ILIKE '%listing%auditor%'
    OR value ILIKE 'listing auditor'
    OR trim(value) = ''
  );

UPDATE settings
SET value = 'Seller Lens', updated_at = NOW()
WHERE key = 'email_from_name'
  AND value ILIKE '%listing%auditor%';
