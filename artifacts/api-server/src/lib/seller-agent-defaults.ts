export type PlatformSkillDefinition = {
  id: string;
  description: string;
  isPlatform: true;
};

export const DEFAULT_PLATFORM_SKILLS: PlatformSkillDefinition[] = [
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

export const ALL_PLATFORM_SKILL_IDS = DEFAULT_PLATFORM_SKILLS.map((skill) => skill.id);

const LEGACY_PLATFORM_SKILL_KEYS: Record<string, string[]> = {
  "sm:brand-research": ["fetch_listing", "analyze_competitor", "sl:brand-research"],
  "sm:create-listing-images": ["generate_content", "sl:create-listing-images"],
  "sm:market-research": ["workspace_catalog", "sl:market-research"],
  "sm:search-term-tuneup": ["query_ads", "sl:search-term-tuneup"],
  "sm:skillify": ["sl:skillify"],
};

export function normalizeEnabledSkills(enabledSkills: string[] | null | undefined): string[] {
  const input = enabledSkills ?? [];
  const normalized = new Set<string>();

  for (const skillId of input) {
    if (skillId.startsWith("sm:")) normalized.add(skillId);
  }

  for (const platformSkill of DEFAULT_PLATFORM_SKILLS) {
    const legacyKeys = LEGACY_PLATFORM_SKILL_KEYS[platformSkill.id] ?? [];
    if (legacyKeys.some((key) => input.includes(key))) {
      normalized.add(platformSkill.id);
    }
  }

  return Array.from(normalized);
}

export type DefaultSellerAgentTemplate = {
  name: string;
  description: string;
  instructions: string;
  icon: string;
  enabledSkills: string[];
};

export const DEFAULT_SELLER_AGENT_TEMPLATES: DefaultSellerAgentTemplate[] = [
  {
    name: "Listing Optimizer",
    description: "Improve Amazon titles, bullets, keywords, and conversion-focused copy.",
    icon: "file-search",
    enabledSkills: ALL_PLATFORM_SKILL_IDS,
    instructions: [
      "You are Listing Optimizer, an Amazon listing specialist for SellerLens sellers.",
      "Focus on clarity, keyword placement, compliance, and conversion.",
      "When answering, cite listing fields (title, bullets, backend keywords) and give actionable rewrites.",
      "Prefer concise, scannable bullet recommendations.",
    ].join("\n"),
  },
  {
    name: "Ads Analyst",
    description: "Analyze PPC campaigns, search terms, and suggest negatives and bid ideas.",
    icon: "zap",
    enabledSkills: ALL_PLATFORM_SKILL_IDS,
    instructions: [
      "You are Ads Analyst, an Amazon PPC strategist.",
      "Help sellers interpret campaign performance, search terms, and wasted spend.",
      "Suggest negatives, structure improvements, and testing priorities.",
      "Be specific and tie recommendations to metrics when available.",
    ].join("\n"),
  },
  {
    name: "Competitor Scout",
    description: "Compare your listing against competitors and highlight gaps.",
    icon: "eye",
    enabledSkills: ALL_PLATFORM_SKILL_IDS,
    instructions: [
      "You are Competitor Scout, a competitive intelligence assistant for Amazon sellers.",
      "Compare positioning, claims, keywords, and creative angles versus competitors.",
      "Highlight differentiation opportunities and risks.",
    ].join("\n"),
  },
  {
    name: "Catalog Manager",
    description: "Review catalog health, SKUs, and listing completeness across products.",
    icon: "package",
    enabledSkills: ALL_PLATFORM_SKILL_IDS,
    instructions: [
      "You are Catalog Manager, helping sellers maintain a healthy product catalog.",
      "Focus on completeness, consistency, and prioritization across SKUs.",
      "Flag missing fields, weak listings, and sync issues.",
    ].join("\n"),
  },
  {
    name: "Brand Voice",
    description: "Keep tone and messaging consistent using your brand guidelines.",
    icon: "message-square",
    enabledSkills: ALL_PLATFORM_SKILL_IDS,
    instructions: [
      "You are Brand Voice, a brand consistency coach for Amazon listings.",
      "Use uploaded brand guidelines and prior approved copy when available.",
      "Rewrite content to match the seller's tone while staying Amazon-compliant.",
    ].join("\n"),
  },
];

export const SELLER_AGENT_SKILL_LABELS: Record<string, string> = {
  "sm:brand-research": "Brand research",
  "sm:create-listing-images": "Create listing images",
  "sm:market-research": "Market research",
  "sm:search-term-tuneup": "Search term tune-up",
  "sm:skillify": "Skillify workflows",
  "sl:brand-research": "Brand research",
  "sl:create-listing-images": "Create listing images",
  "sl:market-research": "Market research",
  "sl:search-term-tuneup": "Search term tune-up",
  "sl:skillify": "Skillify workflows",
  fetch_listing: "Fetch listing by ASIN/URL",
  audit_listing: "Run listing audit",
  query_ads: "Query ads data",
  analyze_competitor: "Analyze competitor",
  workspace_catalog: "Workspace catalog context",
  generate_content: "Generate listing content",
};
