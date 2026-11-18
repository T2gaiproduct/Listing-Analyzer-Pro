-- Read-only checks after scripts/pre-main-merge-cms-sync.mjs
-- Run: psql "$DATABASE_URL" -f scripts/sql/pre-main-cms-content-verify.sql

\echo '=== Tutorial SOP titles (items 1-3) ==='
SELECT field_key, LEFT(value, 80) AS value_preview
FROM cms_content
WHERE page_slug = 'homepage'
  AND section_key = 'tutorials'
  AND field_key IN ('item1_title', 'item2_title', 'item3_title', 'item1_sop', 'item2_sop', 'item3_sop')
ORDER BY field_key;

\echo '=== About page sample keys ==='
SELECT field_key, LEFT(value, 60) AS value_preview
FROM cms_content
WHERE page_slug = 'homepage'
  AND section_key = 'about'
  AND field_key IN ('hero_heading_line1', 'mission_heading', 'values_heading')
ORDER BY field_key;

\echo '=== Instagram footer (optional) ==='
SELECT field_key, value
FROM cms_content
WHERE page_slug = 'homepage'
  AND section_key = 'footer'
  AND field_key = 'social_instagram';