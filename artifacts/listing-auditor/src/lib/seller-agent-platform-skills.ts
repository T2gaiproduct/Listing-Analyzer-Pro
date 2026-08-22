import type { PlatformSkill } from "@/lib/seller-agents";

export const FALLBACK_PLATFORM_SKILLS: PlatformSkill[] = [
  {
    id: "sm:brand-research",
    description:
      "Research the competitive landscape around any Amazon brand someone names — their own or a competitor's. Understand positioning, keywords, and gaps.",
    isPlatform: true,
  },
  {
    id: "sm:create-listing-images",
    description:
      "Create a full set of Amazon listing images for one product in a single pass — a strong main image, lifestyle shots, and infographics.",
    isPlatform: true,
  },
  {
    id: "sm:market-research",
    description:
      "Find the account's #1 product by revenue and run a complete competitive deep-dive on it — positioning, keywords, and growth opportunities.",
    isPlatform: true,
  },
  {
    id: "sm:search-term-tuneup",
    description:
      "Work through your Sponsored Products search-term report to find the winners worth scaling and the wasted spend to cut.",
    isPlatform: true,
  },
  {
    id: "sm:skillify",
    description:
      "Create a new reusable skill from a workflow the user describes (or one that just happened in chat) — turn repeated tasks into one-click actions.",
    isPlatform: true,
  },
];

const LEGACY_SKILL_KEYS: Record<string, string[]> = {
  "sm:brand-research": ["fetch_listing", "analyze_competitor", "sl:brand-research"],
  "sm:create-listing-images": ["generate_content", "sl:create-listing-images"],
  "sm:market-research": ["workspace_catalog", "sl:market-research"],
  "sm:search-term-tuneup": ["query_ads", "sl:search-term-tuneup"],
  "sm:skillify": ["sl:skillify"],
};

export function isPlatformSkillEnabled(skillId: string, enabledSkills: string[]): boolean {
  if (enabledSkills.includes(skillId)) return true;
  const legacy = LEGACY_SKILL_KEYS[skillId] ?? [];
  return legacy.some((key) => enabledSkills.includes(key));
}

export function togglePlatformSkill(
  skillId: string,
  enabled: boolean,
  enabledSkills: string[],
): string[] {
  const legacy = LEGACY_SKILL_KEYS[skillId] ?? [];
  const withoutSkill = enabledSkills.filter((key) => key !== skillId && !legacy.includes(key));

  if (!enabled) return withoutSkill;
  return [...withoutSkill, skillId];
}

export function resolvePlatformSkills(skills?: PlatformSkill[]): PlatformSkill[] {
  return skills?.length ? skills : FALLBACK_PLATFORM_SKILLS;
}
