#!/usr/bin/env node
/**
 * Pre-main / production CMS data sync (no DDL).
 *
 * Recent UI features (tutorials SOP, About page CMS, Instagram footer) use the
 * existing `cms_content` table — no new columns or tables.
 *
 * Usage on production (after deploy, before or after merge to main):
 *   export DATABASE_URL="postgresql://USER:PASS@HOST:5432/DBNAME"
 *   node scripts/pre-main-merge-cms-sync.mjs
 *
 * Options (env):
 *   FORCE=1           — overwrite existing rows (default: only insert missing keys)
 *   INSTAGRAM_URL=... — upsert footer.social_instagram when set
 *
 * Tutorials 1–3 are always updated (Build / Audit / Graphics SOP copy).
 *
 * Full staging→main schema (unrelated tables): run scripts/sync-production-db.sh first.
 */
import pg from "pg";

const PAGE = "homepage";

/** section_key → { field_key: value } */
const UPSERT_SECTIONS = {
  tutorials: {
    item1_title: "Build Your Brand",
    item1_description:
      "Build a full listing step by step — upload, AI copy, images, A+, preview, and export.",
    item1_category: "getting-started",
    item1_steps: "8",
    item1_sop: `Sign in and open Build Your Brand from the sidebar.
Choose existing product, import from link, or create from scratch.
Upload product photos and enter product name, brand, and category.
Use the Listing step for AI title, bullets, and description — edit as needed.
Create main listing images in the Graphics step.
Add A+ content in the workflow when your listing needs it.
Open Listing Preview to check how the listing looks.
Export Excel or CSV when you are ready to use the listing elsewhere.`,
    item2_title: "Audit Your Listing",
    item2_description: "Score any listing with AI, see what to fix, and track improvements over time.",
    item2_category: "analytics",
    item2_steps: "6",
    item2_sop: `Open Audit Listing from the sidebar.
Start with import from link or an existing product in your account.
Pick marketplace, paste the product URL, fetch, and continue to run the audit.
Review your overall score and each category on the results page.
Read issues and suggestions for title, bullets, images, and more.
Apply fixes or download a report, then run another audit later to see improvement.`,
    item3_title: "Create Graphics",
    item3_description: "Create AI product images — lifestyle, hero, infographics, or A+ modules.",
    item3_category: "images",
    item3_steps: "6",
    item3_sop: `Open Create Graphics from the sidebar.
Choose create from scratch or an existing product.
Upload photos and enter product name, brand, and category.
Pick gallery images or A+ images for this run.
Select image types, customize style if needed, and generate.
Review the gallery, regenerate weak images, and download or save.`,
  },
  about: {
    hero_heading_line1: "Built for Amazon sellers,",
    hero_heading_line2: "by Amazon sellers",
    hero_subheading:
      "Ecommerce Guru was created to solve a problem every Amazon seller faces: knowing whether their listings are good enough to win the Buy Box and rank on page one.",
    mission_heading: "Our Mission",
    mission_body_1:
      "We believe every Amazon seller deserves access to world-class listing optimization tools — not just the ones with big agencies or deep pockets. Our AI-powered platform levels the playing field.",
    mission_body_2:
      "From title analysis to image quality scoring, keyword research to competitor benchmarking, we give sellers the data and insights they need to make smarter decisions and sell more.",
    mission_highlight1_title: "Instant Analysis",
    mission_highlight1_desc: "Get full audit results in under 60 seconds",
    mission_highlight2_title: "Data-Driven",
    mission_highlight2_desc: "Scores based on real Amazon ranking factors",
    mission_highlight3_title: "Community Powered",
    mission_highlight3_desc: "Feedback from thousands of active sellers",
    values_heading: "Our Values",
    values_subheading: "The principles that guide every decision we make.",
    value1_title: "Results-Driven",
    value1_desc:
      "Every feature we build is designed to improve your Amazon rankings and conversion rates.",
    value2_title: "AI-Powered",
    value2_desc:
      "We use cutting-edge language models to deliver insights no human can match at scale.",
    value3_title: "Seller-First",
    value3_desc:
      "Built by Amazon sellers, for Amazon sellers. We understand the platform inside and out.",
    value4_title: "Global Reach",
    value4_desc: "Supporting sellers across all Amazon marketplaces: US, UK, EU, Japan, and more.",
    value5_title: "Excellence",
    value5_desc: "We obsess over data quality, accuracy, and actionable recommendations.",
    value6_title: "Community",
    value6_desc: "Thousands of sellers trust us to optimize their listings and grow their business.",
    journey_heading: "Our Journey",
    journey_subheading: "How Ecommerce Guru has evolved.",
    milestone1_year: "2024",
    milestone1_title: "Founded",
    milestone1_desc:
      "Ecommerce Guru launched with a mission to democratize Amazon listing optimization.",
    milestone2_year: "2025",
    milestone2_title: "First 1,000 Sellers",
    milestone2_desc:
      "Reached our first milestone of helping 1,000 active Amazon sellers improve their listings.",
    milestone3_year: "2025",
    milestone3_title: "AI Expansion",
    milestone3_desc: "Added AI content generation, image studio, and EBC module creation.",
    milestone4_year: "2026",
    milestone4_title: "Enterprise Launch",
    milestone4_desc:
      "Launched enterprise tier with team management, white-label reporting, and API access.",
  },
};

const FORCE = process.env.FORCE === "1";
const ALWAYS_UPDATE_SECTIONS = new Set(["tutorials"]);

async function upsert(client, sectionKey, fieldKey, value, { force }) {
  const existing = await client.query(
    `SELECT id FROM cms_content
     WHERE page_slug = $1 AND section_key = $2 AND field_key = $3
     LIMIT 1`,
    [PAGE, sectionKey, fieldKey],
  );
  if (existing.rowCount > 0) {
    if (!force) {
      console.log(`  skip (exists) ${sectionKey}.${fieldKey}`);
      return;
    }
    await client.query(`UPDATE cms_content SET value = $1, updated_at = NOW() WHERE id = $2`, [
      value,
      existing.rows[0].id,
    ]);
    console.log(`  update ${sectionKey}.${fieldKey}`);
    return;
  }
  await client.query(
    `INSERT INTO cms_content (page_slug, section_key, field_key, value, updated_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [PAGE, sectionKey, fieldKey, value],
  );
  console.log(`  insert ${sectionKey}.${fieldKey}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL to the production Postgres connection string.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  console.log("CMS content sync (cms_content only, no schema DDL)");
  console.log(`FORCE=${FORCE} — tutorials section always updated`);

  try {
    for (const [sectionKey, fields] of Object.entries(UPSERT_SECTIONS)) {
      console.log(`\n[${sectionKey}]`);
      const forceSection = FORCE || ALWAYS_UPDATE_SECTIONS.has(sectionKey);
      for (const [fieldKey, value] of Object.entries(fields)) {
        await upsert(client, sectionKey, fieldKey, value, { force: forceSection });
      }
    }

    const instagram = process.env.INSTAGRAM_URL?.trim();
    if (instagram) {
      console.log("\n[footer]");
      await upsert(client, "footer", "social_instagram", instagram, { force: true });
    } else {
      console.log("\n[footer] skip social_instagram (set INSTAGRAM_URL to upsert)");
    }

    const count = await client.query(
      `SELECT COUNT(*)::int AS n FROM cms_content WHERE page_slug = $1`,
      [PAGE],
    );
    console.log(`\nDone. homepage cms_content rows: ${count.rows[0].n}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});