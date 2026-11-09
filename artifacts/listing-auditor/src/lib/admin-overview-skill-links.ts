import type { AiSkillRecord } from "@/lib/admin-ai-skills-api";

export function findCategorySkillSlug(
  skills: AiSkillRecord[],
  category: string,
  skillType: AiSkillRecord["skillType"],
): string | null {
  const row = skills.find(
    (s) =>
      s.skillKind === "custom"
      && s.category === category
      && s.skillType === skillType,
  );
  return row?.slug ?? null;
}

export function skillTypeLabel(skill: AiSkillRecord): string {
  if (skill.skillKind === "marketplace_content") return "Marketplace listing";
  if (skill.skillKind === "image_prompt") {
    return skill.skillType === "aplus_content" ? "A+ image prompt" : "Graphics image prompt";
  }
  const type = skill.skillType.replace(/_/g, " ");
  return skill.category ? `${type} · ${skill.category}` : type;
}
