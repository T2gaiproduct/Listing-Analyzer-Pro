import { eq } from "drizzle-orm";
import { aiSkillsTable, db, imagePromptTemplatesTable } from "@workspace/db";
import { ensureImagePromptTemplateLinkedForSkill } from "../src/lib/image-prompt-skill-sync.js";
import { listEnabledImagePromptTemplates } from "../src/lib/image-prompt-template-service.js";

async function main() {
  const instructions = `name: Heroshot
---
Create one premium Amazon main product image for {{productDesc}}. White background, centered product.`;

  const [skill] = await db
    .insert(aiSkillsTable)
    .values({
      slug: `heroshot-test-skill-${Date.now()}`,
      name: "Heroshot",
      status: "published",
      skillType: "product_images",
      category: "",
      marketplaceSlug: "amazon",
      aiModel: "",
      instructionsText: instructions,
      updatedAt: new Date(),
    })
    .returning();

  const linked = await ensureImagePromptTemplateLinkedForSkill(skill!);
  const enabled = await listEnabledImagePromptTemplates("graphics");
  const hero = enabled.find((t) => t.slug === "hero");
  console.log("linked template id", linked.imagePromptTemplateId, "skill slug", linked.slug);
  console.log("graphics hero enabled", hero?.enabled === 1, "prompt len", hero?.promptTemplate.length);

  await db.delete(aiSkillsTable).where(eq(aiSkillsTable.id, skill!.id));
  await db
    .update(imagePromptTemplatesTable)
    .set({ promptTemplate: hero?.promptTemplate ?? "", updatedAt: new Date() })
    .where(eq(imagePromptTemplatesTable.id, hero?.id ?? 0));

  if (!linked.imagePromptTemplateId || !hero || hero.enabled !== 1) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});