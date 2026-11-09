/** Mirrors server split between YAML header and generation body in marketplace skills. */
export function extractSkillInstructionBody(instructionsText: string): string {
  const marker = "\n---\n";
  const idx = instructionsText.indexOf(marker);
  if (idx >= 0) return instructionsText.slice(idx + marker.length).trim();
  return instructionsText.trim();
}

export const MARKETPLACE_SKILL_SLUG_PREFIX = "marketplace-content-";

export function isMarketplaceContentSkillSlug(slug: string): boolean {
  return slug.startsWith(MARKETPLACE_SKILL_SLUG_PREFIX);
}
