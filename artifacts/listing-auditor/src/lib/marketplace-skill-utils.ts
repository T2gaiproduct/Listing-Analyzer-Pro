/** Normalize skill file text so Windows uploads and `---` delimiters parse reliably. */
export function normalizeSkillInstructionText(instructionsText: string): string {
  return instructionsText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Mirrors server split between YAML header and generation body in marketplace skills. */
export function extractSkillInstructionBody(instructionsText: string): string {
  const normalized = normalizeSkillInstructionText(instructionsText).trim();
  const marker = "\n---\n";
  const idx = normalized.indexOf(marker);
  if (idx >= 0) return normalized.slice(idx + marker.length).trim();
  if (normalized.startsWith("---\n")) return normalized.slice(4).trim();
  return normalized;
}

export const MARKETPLACE_SKILL_SLUG_PREFIX = "marketplace-content-";

export function isMarketplaceContentSkillSlug(slug: string): boolean {
  return slug.startsWith(MARKETPLACE_SKILL_SLUG_PREFIX);
}
