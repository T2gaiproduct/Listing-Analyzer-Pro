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

const DEFAULT_FEATURE_COSTS: Record<string, number> = {
  audit: 1,
  content: 1,
  ebc: 1,
  competitors: 1,
  graphics: 8,
  images: 8,
};

function ruleCostFromList(
  featureType: string,
  rules: CreditRuleLike[],
  fallback: number,
): number {
  const rule = rules.find((r) => r.featureType === featureType);
  if (rule && rule.isActive !== false) return rule.creditsRequired;
  return DEFAULT_FEATURE_COSTS[featureType] ?? fallback;
}

export interface PlanAllocationCounts {
  audit: number;
  content: number;
  images: number;
  ebc: number;
  competitors: number;
  teamMembers: number;
}

export interface PlanRowForAllocations {
  auditCredits: number;
  aiCredits: number;
  imageCredits: number;
  teamMembers: number;
  creditAllocations?: PlanAllocations | Record<string, number> | null;
}

export interface PlanActivityRow {
  label: string;
  value: number;
  color: string;
}

const PLAN_ACTIVITY_ROW_META: { key: keyof PlanAllocationCounts; label: string; color: string }[] = [
  { key: "audit", label: "Audit", color: "text-orange-700" },
  { key: "content", label: "Text Content", color: "text-blue-700" },
  { key: "images", label: "Images", color: "text-purple-700" },
  { key: "ebc", label: "A+ / EBC Content", color: "text-emerald-700" },
  { key: "competitors", label: "Competitors Analysis", color: "text-slate-700" },
  { key: "teamMembers", label: "Team Members", color: "text-slate-700" },
];

/** Monthly activity counts from admin creditAllocations, with legacy column fallback. */
export function resolvePlanAllocationCounts(plan: PlanRowForAllocations): PlanAllocationCounts {
  const a = plan.creditAllocations ?? {};
  const hasStoredAllocations = Object.keys(a).length > 0;

  if (hasStoredAllocations) {
    return {
      audit: a.audit ?? 0,
      content: a.content ?? a.ai ?? 0,
      images: a.images ?? a.image ?? 0,
      ebc: a.ebc ?? 0,
      competitors: a.competitors ?? 0,
      teamMembers: a.teamMembers ?? plan.teamMembers ?? 0,
    };
  }

  return {
    audit: plan.auditCredits,
    content: plan.aiCredits,
    images: plan.imageCredits,
    ebc: 0,
    competitors: 0,
    teamMembers: plan.teamMembers,
  };
}

export function buildPlanActivityRows(plan: PlanRowForAllocations): PlanActivityRow[] {
  const counts = resolvePlanAllocationCounts(plan);
  return PLAN_ACTIVITY_ROW_META.map(({ key, label, color }) => ({
    label,
    color,
    value: counts[key],
  }));
}

export function formatPlanAllocationDisplayValue(value: number): string {
  if (value >= 999) return "∞";
  return value.toLocaleString();
}

export function computePlanCreditsFromPlan(
  plan: PlanRowForAllocations,
  rules: CreditRuleLike[] = [],
): PlanCreditsComputed {
  const counts = resolvePlanAllocationCounts(plan);
  return computePlanCreditsFromAllocations(counts, rules);
}

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

export function formatPlanAllocationsSummary(allocations: PlanCreditsComputed["allocations"]): string {
  const parts: string[] = [];
  if (allocations.audit > 0) parts.push(`${allocations.audit} audit${allocations.audit === 1 ? "" : "s"}`);
  if (allocations.content > 0) parts.push(`${allocations.content} text`);
  if (allocations.images > 0) parts.push(`${allocations.images} image${allocations.images === 1 ? "" : "s"}`);
  if (allocations.ebc > 0) parts.push(`${allocations.ebc} A+ / EBC`);
  if (allocations.competitors > 0) parts.push(`${allocations.competitors} competitor${allocations.competitors === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
