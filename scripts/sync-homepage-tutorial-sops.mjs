#!/usr/bin/env node
/**
 * Upsert tutorials items 1–3 on homepage CMS (Build Your Brand, Audit Listing, Create Graphics).
 * Usage: DATABASE_URL=postgresql://... node scripts/sync-homepage-tutorial-sops.mjs
 */
import pg from "pg";

const FIELDS = {
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
};

async function upsert(client, fieldKey, value) {
  const existing = await client.query(
    `SELECT id FROM cms_content WHERE page_slug = $1 AND section_key = $2 AND field_key = $3 LIMIT 1`,
    ["homepage", "tutorials", fieldKey],
  );
  if (existing.rowCount > 0) {
    await client.query(
      `UPDATE cms_content SET value = $1, updated_at = NOW() WHERE id = $2`,
      [value, existing.rows[0].id],
    );
  } else {
    await client.query(
      `INSERT INTO cms_content (page_slug, section_key, field_key, value, updated_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ["homepage", "tutorials", fieldKey, value],
    );
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const [fieldKey, value] of Object.entries(FIELDS)) {
      await upsert(client, fieldKey, value);
      console.log(`Synced tutorials.${fieldKey}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});