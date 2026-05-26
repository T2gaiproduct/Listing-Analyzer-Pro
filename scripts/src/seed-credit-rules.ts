import pg from "pg";

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const defaults = [
    { activity_name: "Audit", feature_type: "audit", credit_type: "audit", credits_required: 1, is_active: true, sort_order: 1 },
    { activity_name: "Text Content", feature_type: "content", credit_type: "ai", credits_required: 1, is_active: true, sort_order: 2 },
    { activity_name: "A+ / EBC Content", feature_type: "ebc", credit_type: "ai", credits_required: 1, is_active: true, sort_order: 3 },
    { activity_name: "Images (Bulk)", feature_type: "images", credit_type: "image", credits_required: 6, is_active: true, sort_order: 4 },
    { activity_name: "Image Regenerate", feature_type: "image_regenerate", credit_type: "image", credits_required: 1, is_active: true, sort_order: 5 },
    { activity_name: "Image Edit", feature_type: "image_edit", credit_type: "image", credits_required: 1, is_active: true, sort_order: 6 },
    { activity_name: "Competitors Analysis", feature_type: "competitors", credit_type: "audit", credits_required: 1, is_active: true, sort_order: 7 },
  ];

  for (const d of defaults) {
    const { rows } = await client.query(
      `SELECT id FROM credit_rules WHERE feature_type = $1`,
      [d.feature_type]
    );
    if (rows.length === 0) {
      await client.query(
        `INSERT INTO credit_rules (activity_name, feature_type, credit_type, credits_required, is_active, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [d.activity_name, d.feature_type, d.credit_type, d.credits_required, d.is_active, d.sort_order]
      );
      console.log(`Created rule: ${d.activity_name}`);
    } else {
      await client.query(
        `UPDATE credit_rules SET
          activity_name = $1, credit_type = $2, credits_required = $3, is_active = $4, sort_order = $5, updated_at = NOW()
         WHERE id = $6`,
        [d.activity_name, d.credit_type, d.credits_required, d.is_active, d.sort_order, rows[0].id]
      );
      console.log(`Updated rule: ${d.activity_name}`);
    }
  }

  await client.end();
  console.log("Credit rules seeded successfully.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
