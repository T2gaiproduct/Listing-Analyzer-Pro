export type AgentToolName =
  | "get_seller_memory"
  | "get_amazon_listing"
  | "audit_listing"
  | "save_agent_memory";

export type AgentToolDefinition = {
  name: AgentToolName;
  label: string;
  description: string;
  defaultRequiresApproval: boolean;
};

export const AGENT_TOOL_CATALOG: AgentToolDefinition[] = [
  {
    name: "get_seller_memory",
    label: "Get seller memory",
    description: "Load memory files and preferences for the current agent.",
    defaultRequiresApproval: false,
  },
  {
    name: "get_amazon_listing",
    label: "Get Amazon listing",
    description: "Fetch listing data by ASIN or product URL.",
    defaultRequiresApproval: false,
  },
  {
    name: "audit_listing",
    label: "Audit listing",
    description: "Run an AI listing audit and return scores and recommendations.",
    defaultRequiresApproval: false,
  },
  {
    name: "save_agent_memory",
    label: "Save agent memory",
    description: "Persist a memory snippet or preference for future conversations.",
    defaultRequiresApproval: false,
  },
];

export type DefaultAgentSlug = "listing-audit" | "graphics" | "ppc";

export type DefaultAgentDefinition = {
  slug: DefaultAgentSlug;
  name: string;
  description: string;
  icon: string;
  model: string;
  systemPrompt: string;
  tools: AgentToolName[];
};

export const WORKSPACE_DEFAULT_AGENTS: DefaultAgentDefinition[] = [
  {
    slug: "listing-audit",
    name: "Listing Audit Agent",
    description: "Analyze Amazon listings, run audits, and recommend title, bullets, and image improvements.",
    icon: "clipboard-check",
    model: "gpt-5.4",
    systemPrompt: `You are SellerLens AI Listing Audit Agent for Amazon sellers.
Help users audit listings, interpret audit scores, and suggest concrete improvements to titles, bullets, keywords, and images.
Ask for an ASIN or URL when listing context is missing. Be concise and actionable.`,
    tools: ["get_seller_memory", "get_amazon_listing", "audit_listing", "save_agent_memory"],
  },
  {
    slug: "graphics",
    name: "Graphics Agent",
    description: "Plan listing images, infographics, and A+ content using brand and product context.",
    icon: "image",
    model: "gpt-5.4",
    systemPrompt: `You are SellerLens AI Graphics Agent for Amazon sellers.
Help users plan main images, lifestyle shots, infographics, and A+ content that convert.
Use brand voice and product details from memory when available. Ask clarifying questions about style and audience.`,
    tools: ["get_seller_memory", "get_amazon_listing", "save_agent_memory"],
  },
  {
    slug: "ppc",
    name: "PPC Agent",
    description: "Optimize Amazon Ads campaigns, bids, keywords, and ACOS using account context.",
    icon: "target",
    model: "gpt-5.4",
    systemPrompt: `You are SellerLens AI PPC Agent for Amazon advertising.
Help users improve ACOS, bids, budgets, keywords, and campaign structure.
Give specific recommendations and explain trade-offs. Request metrics or campaign names when needed.`,
    tools: ["get_seller_memory", "save_agent_memory"],
  },
];

export const SUPPORTED_AGENT_MODELS = [
  "gpt-5.4",
  "gpt-4.1",
  "gpt-4o",
] as const;

export type SupportedAgentModel = (typeof SUPPORTED_AGENT_MODELS)[number];

export function isValidAgentToolName(name: string): name is AgentToolName {
  return AGENT_TOOL_CATALOG.some((tool) => tool.name === name);
}

export function getDefaultToolsForSlug(slug: string): AgentToolName[] {
  const agent = WORKSPACE_DEFAULT_AGENTS.find((row) => row.slug === slug);
  return agent?.tools ?? [];
}
