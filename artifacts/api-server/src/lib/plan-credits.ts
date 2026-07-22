import { getCreditCost } from "./credits";

export interface PlanAllocations {
  audit?: number;
  content?: number;
  ai?: number;
  images?: number;
  image?: number;
  ebc?: number;
  competitors?: number;
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

export const DEFAULT_FEATURE_COSTS: Record<string, number> = {
  audit: 1,
  content: 1,
  ebc: 1,
  competitors: 1,
  graphics: 8,
  images: 8,
};

export function ruleCostFromList(
  featureType: string,
  rules: CreditRuleLike[],
  fallback: number,
): number {
  const rule = rules.find((r) => r.featureType === featureType);
  if (rule && rule.isActive !== false) return rule.creditsRequired;
  return DEFAULT_FEATURE_COSTS[featureType] ?? fallback;
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
  return {
    aiCredits: plan.aiCredits,
    imageCredits: plan.imageCredits,
    auditCredits: plan.auditCredits,
  };
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
