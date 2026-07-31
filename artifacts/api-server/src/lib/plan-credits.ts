import { getCreditCost } from "./credits";

export interface PlanAllocations {
  audit?: number;
  content?: number;
  ai?: number;
  images?: number;
  image?: number;
  ebc?: number;
  competitors?: number;
  teamMembers?: number;
}

export interface PlanCreditPools {
  auditCredits: number;
  aiCredits: number;
  imageCredits: number;
}

export interface PlanCreditsComputed extends PlanCreditPools {
  totalCredits: number;
  allocations: {
    audit: number;
    content: number;
    images: number;
    ebc: number;
    competitors: number;
  };
}

export interface CreditRuleLike {
  featureType: string;
  creditsRequired: number;
  isActive?: boolean;
}

export interface PlanAllocationCounts {
  audit: number;
  content: number;
  images: number;
  ebc: number;
  competitors: number;
  teamMembers: number;
}

export const DEFAULT_FEATURE_COSTS: Record<string, number> = {
  audit: 1,
  content: 1,
  ebc: 1,
  competitors: 1,
  graphics: 8,
  images: 8,
  ai: 1,
  img: 8,
};

const CREDIT_RULE_FEATURE_ALIASES: Record<string, string[]> = {
  audit: ["audit"],
  content: ["content", "ai"],
  ai: ["content", "ai"],
  graphics: ["graphics", "img", "images"],
  images: ["graphics", "img", "images"],
  img: ["graphics", "img", "images"],
  ebc: ["ebc"],
  competitors: ["competitors"],
};

function creditRuleLookupTypes(featureType: string): string[] {
  return CREDIT_RULE_FEATURE_ALIASES[featureType] ?? [featureType];
}

export function ruleCostFromList(
  featureType: string,
  rules: CreditRuleLike[],
  fallback: number,
): number {
  for (const lookupType of creditRuleLookupTypes(featureType)) {
    const rule = rules.find((r) => r.featureType === lookupType);
    if (rule && rule.isActive !== false) return rule.creditsRequired;
  }
  return DEFAULT_FEATURE_COSTS[featureType] ?? fallback;
}

function poolsFromLegacyColumns(plan: {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
}): PlanCreditPools {
  return {
    aiCredits: plan.aiCredits,
    imageCredits: plan.imageCredits,
    auditCredits: plan.auditCredits,
  };
}

export function allocationCountsFromRecord(
  allocations: PlanAllocations | Record<string, number>,
  teamMembers = 1,
): PlanAllocationCounts {
  const a = allocations ?? {};
  return {
    audit: a.audit ?? 0,
    content: a.content ?? a.ai ?? 0,
    images: a.images ?? a.image ?? 0,
    ebc: a.ebc ?? 0,
    competitors: a.competitors ?? 0,
    teamMembers: a.teamMembers ?? teamMembers,
  };
}

/** Infer monthly activity limits from legacy credit pool columns using credit rules. */
export async function inferAllocationCountsFromLegacyPools(
  plan: {
    auditCredits: number;
    aiCredits: number;
    imageCredits: number;
    teamMembers: number;
  },
): Promise<PlanAllocationCounts> {
  const [auditCost, contentCost, graphicsCost] = await Promise.all([
    getCreditCost("audit"),
    getCreditCost("content"),
    getCreditCost("graphics"),
  ]);

  const div = (pool: number, cost: number) => (cost > 0 ? Math.floor(pool / cost) : 0);

  return {
    audit: div(plan.auditCredits, auditCost.creditsRequired),
    content: div(plan.aiCredits, contentCost.creditsRequired),
    images: div(plan.imageCredits, graphicsCost.creditsRequired),
    ebc: 0,
    competitors: 0,
    teamMembers: plan.teamMembers,
  };
}

const AUTO_CREDIT_FEATURE_PATTERNS = [
  /listing audits?/i,
  /AI content credits/i,
  /image generation credits/i,
  /A\+.*EBC/i,
  /competitor analys/i,
  /^\d+\s+team members$/i,
  /unlimited listing audits/i,
];

export function isAutoCreditFeatureLine(text: string): boolean {
  return AUTO_CREDIT_FEATURE_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

export function buildPlanCreditFeatureLines(
  counts: PlanAllocationCounts,
  pools: PlanCreditPools,
): string[] {
  const lines: string[] = [];

  if (counts.audit > 0) {
    lines.push(
      counts.audit >= 999
        ? "Unlimited listing audits"
        : `${counts.audit.toLocaleString()} listing audits/mo`,
    );
  }

  if (pools.aiCredits > 0) {
    lines.push(`${pools.aiCredits.toLocaleString()} AI content credits`);
  }

  if (pools.imageCredits > 0) {
    lines.push(`${pools.imageCredits.toLocaleString()} image generation credits`);
  }

  if (counts.ebc > 0) {
    lines.push(`${counts.ebc.toLocaleString()} A+ / EBC content credits`);
  }

  if (counts.competitors > 0) {
    lines.push(
      `${counts.competitors.toLocaleString()} competitor analys${counts.competitors === 1 ? "is" : "es"}`,
    );
  }

  if (counts.teamMembers > 1) {
    lines.push(`${counts.teamMembers.toLocaleString()} team members`);
  }

  return lines;
}

/** Keep manual feature bullets; replace auto-generated credit lines. */
export function mergePlanFeatureLists(creditLines: string[], existingFeatures: string[]): string[] {
  const manual = existingFeatures.filter((line) => !isAutoCreditFeatureLine(line));
  return [...creditLines, ...manual];
}

export async function syncPlanFeaturesForSave(
  allocations: PlanAllocations | Record<string, number>,
  teamMembers: number,
  existingFeatures: string[] | undefined,
): Promise<string[]> {
  const pools = await computePlanPoolsFromAllocations(allocations);
  const counts = allocationCountsFromRecord(allocations, teamMembers);
  const creditLines = buildPlanCreditFeatureLines(counts, pools);
  return mergePlanFeatureLists(creditLines, existingFeatures ?? []);
}

/** Sync compute for UI when credit rules are already loaded. */
export function computePlanCreditsFromAllocations(
  allocations: PlanAllocations | Record<string, number> | null | undefined,
  rules: CreditRuleLike[] = [],
): PlanCreditsComputed {
  const a = allocations ?? {};
  const auditCount = a.audit ?? 0;
  const contentCount = a.content ?? a.ai ?? 0;
  const imageCount = a.images ?? a.image ?? 0;
  const ebcCount = a.ebc ?? 0;
  const competitorCount = a.competitors ?? 0;

  const auditCost = ruleCostFromList("audit", rules, 1);
  const contentCost = ruleCostFromList("content", rules, 1);
  const ebcCost = ruleCostFromList("ebc", rules, 1);
  const competitorCost = ruleCostFromList("competitors", rules, 1);
  const imageCost = ruleCostFromList("graphics", rules, ruleCostFromList("images", rules, 8));

  const auditCredits = auditCount * auditCost + competitorCount * competitorCost;
  const aiCredits = contentCount * contentCost + ebcCount * ebcCost;
  const imageCredits = imageCount * imageCost;

  return {
    auditCredits,
    aiCredits,
    imageCredits,
    totalCredits: auditCredits + aiCredits + imageCredits,
    allocations: {
      audit: auditCount,
      content: contentCount,
      images: imageCount,
      ebc: ebcCount,
      competitors: competitorCount,
    },
  };
}

/** DB-backed compute using admin credit rules. */
export async function computePlanPoolsFromAllocations(
  allocations: PlanAllocations | Record<string, number>,
): Promise<PlanCreditPools> {
  const [auditCost, contentCost, ebcCost, competitorCost, graphicsCost] = await Promise.all([
    getCreditCost("audit"),
    getCreditCost("content"),
    getCreditCost("ebc"),
    getCreditCost("competitors"),
    getCreditCost("graphics"),
  ]);

  const auditCount = allocations.audit ?? 0;
  const contentCount = allocations.content ?? allocations.ai ?? 0;
  const imageCount = allocations.images ?? allocations.image ?? 0;
  const ebcCount = allocations.ebc ?? 0;
  const competitorCount = allocations.competitors ?? 0;

  return {
    auditCredits: auditCount * auditCost.creditsRequired + competitorCount * competitorCost.creditsRequired,
    aiCredits: contentCount * contentCost.creditsRequired + ebcCount * ebcCost.creditsRequired,
    imageCredits: imageCount * graphicsCost.creditsRequired,
  };
}

export async function resolvePlanCreditPools(plan: {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  creditAllocations?: PlanAllocations | Record<string, number> | null;
}): Promise<PlanCreditPools> {
  const alloc = plan.creditAllocations;
  if (alloc && Object.keys(alloc).length > 0) {
    return computePlanPoolsFromAllocations(alloc);
  }
  return poolsFromLegacyColumns(plan);
}

export async function planRowToGrantCredits(plan: {
  id: number;
  name: string;
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  creditAllocations?: PlanAllocations | Record<string, number> | null;
}): Promise<{ id: number; name: string; aiCredits: number; imageCredits: number; auditCredits: number }> {
  const pools = await resolvePlanCreditPools(plan);
  return { id: plan.id, name: plan.name, ...pools };
}
