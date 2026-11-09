import type { AiSkillRecord } from "@/lib/admin-ai-skills-api";
import {
  skillCatalogTypeFromRegistry,
  type AdminSkillType,
  type SkillCatalogTypeLabel,
} from "@/lib/admin-skill-types";

export type { SkillCatalogTypeLabel };

export function skillCatalogType(skill: AiSkillRecord, registry: AdminSkillType[]): SkillCatalogTypeLabel {
  return skillCatalogTypeFromRegistry(skill.skillType, registry, skill.skillKind);
}

export function skillCatalogMarketplace(skill: AiSkillRecord): string {
  if (skill.skillKind === "image_prompt") return "—";
  const slug = skill.marketplaceSlug?.trim();
  if (!slug) return "—";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function skillCatalogCategory(skill: AiSkillRecord): string {
  const cat = skill.category?.trim();
  if (cat) return cat;
  if (skill.skillKind === "marketplace_content") return "—";
  if (skill.skillKind === "image_prompt") return "—";
  return "—";
}

export function skillCatalogVersion(skill: AiSkillRecord): string {
  if (!skill.createdAt || !skill.updatedAt) return "v1";
  const created = new Date(skill.createdAt).getTime();
  const updated = new Date(skill.updatedAt).getTime();
  return updated > created + 60_000 ? "v2" : "v1";
}

export function skillCatalogFilename(skill: AiSkillRecord): string {
  return `${skill.slug}.md`;
}
