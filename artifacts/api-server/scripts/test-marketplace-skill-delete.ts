import {
  permanentlyDeleteContentMarketplace,
  marketplaceContentSkillSlug,
} from "../src/lib/content-marketplace-skill-sync.js";
import { getContentMarketplaceBySlug } from "../src/lib/content-marketplace-service.js";
import { ensureDefaultContentMarketplacesSeeded } from "../src/lib/ensure-content-marketplaces.js";
import { getDismissedContentMarketplaceSlugs } from "../src/lib/content-marketplace-dismissed.js";
import { db, aiSkillsTable, contentMarketplacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const mp = await getContentMarketplaceBySlug("other");
  if (!mp) {
    console.log("SKIP: no other marketplace in DB");
    return;
  }
  await permanentlyDeleteContentMarketplace(mp);
  const skillSlug = marketplaceContentSkillSlug("other");
  const skills = await db.select().from(aiSkillsTable).where(eq(aiSkillsTable.slug, skillSlug));
  const mps = await db.select().from(contentMarketplacesTable).where(eq(contentMarketplacesTable.slug, "other"));
  console.log("after delete skills", skills.length, "marketplaces", mps.length);
  const dismissed = await getDismissedContentMarketplaceSlugs();
  console.log("dismissed has other", dismissed.has("other"));
  await ensureDefaultContentMarketplacesSeeded();
  const skills2 = await db.select().from(aiSkillsTable).where(eq(aiSkillsTable.slug, skillSlug));
  const mps2 = await db.select().from(contentMarketplacesTable).where(eq(contentMarketplacesTable.slug, "other"));
  console.log("after ensureDefault skills", skills2.length, "marketplaces", mps2.length);
  if (skills2.length !== 0 || mps2.length !== 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});