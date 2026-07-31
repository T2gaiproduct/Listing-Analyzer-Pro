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

function ruleCostFromList(
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

/** Admin fields are monthly credit allowances; legacy columns are credit pools. */
export function allocationCountsFromLegacyPools(plan: PlanRowForAllocations): PlanAllocationCounts {
  return {
    audit: plan.auditCredits,
    content: plan.aiCredits,
    images: plan.imageCredits,
    ebc: 0,
    competitors: 0,
    teamMembers: plan.teamMembers,
  };
}

export function resolvePlanAllocationCounts(
  plan: PlanRowForAllocations,
  _rules: CreditRuleLike[] = [],
): PlanAllocationCounts {
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

  return allocationCountsFromLegacyPools(plan);
}

export function buildPlanCreditFeatureLines(
  counts: PlanAllocationCounts,
  rules: CreditRuleLike[] = [],
): string[] {
  const lines: string[] = [];
  const auditCost = ruleCostFromList("audit", rules, 1);

  if (counts.audit > 0) {
    const auditsPerMonth = auditCost > 0 ? Math.floor(counts.audit / auditCost) : counts.audit;
    lines.push(
      auditsPerMonth >= 999
        ? "Unlimited listing audits"
        : `${auditsPerMonth.toLocaleString()} listing audits/mo`,
    );
  }

  if (counts.content > 0) {
    lines.push(`${counts.content.toLocaleString()} AI content credits`);
  }

  if (counts.images > 0) {
    lines.push(`${counts.images.toLocaleString()} image generation credits`);
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

export function mergePlanFeatureLists(creditLines: string[], existingFeatures: string[]): string[] {
  const manual = existingFeatures.filter((line) => !isAutoCreditFeatureLine(line));
  return [...creditLines, ...manual];
}

export function resolvePlanDisplayFeatures(
  plan: PlanRowForAllocations & { features?: string[] },
  rules: CreditRuleLike[] = [],
): string[] {
  const counts = resolvePlanAllocationCounts(plan, rules);
  const creditLines = buildPlanCreditFeatureLines(counts, rules);
  return mergePlanFeatureLists(creditLines, plan.features ?? []);
}

export function buildPlanActivityRows(
  plan: PlanRowForAllocations,
  rules: CreditRuleLike[] = [],
): PlanActivityRow[] {
  const counts = resolvePlanAllocationCounts(plan, rules);
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

export function computePlanPoolsFromAllocationCredits(
  allocations: PlanAllocations | Record<string, number>,
): PlanCreditPools {
  const audit = allocations.audit ?? 0;
  const content = allocations.content ?? allocations.ai ?? 0;
  const images = allocations.images ?? allocations.image ?? 0;
  const ebc = allocations.ebc ?? 0;
  const competitors = allocations.competitors ?? 0;

  return {
    auditCredits: audit + competitors,
    aiCredits: content + ebc,
    imageCredits: images,
  };
}

export function computePlanCreditsFromPlan(
  plan: PlanRowForAllocations,
  rules: CreditRuleLike[] = [],
): PlanCreditsComputed {
  const counts = resolvePlanAllocationCounts(plan, rules);
  return computePlanCreditsFromAllocations(counts, rules);
}

export function computePlanCreditsFromAllocations(
  allocations: PlanAllocations | Record<string, number> | null | undefined,
  _rules: CreditRuleLike[] = [],
): PlanCreditsComputed {
  const a = allocations ?? {};
  const audit = a.audit ?? 0;
  const content = a.content ?? a.ai ?? 0;
  const images = a.images ?? a.image ?? 0;
  const ebc = a.ebc ?? 0;
  const competitors = a.competitors ?? 0;
  const pools =
    Object.keys(a).length > 0
      ? computePlanPoolsFromAllocationCredits(a)
      : { auditCredits: audit + competitors, aiCredits: content + ebc, imageCredits: images };

  return {
    ...pools,
    totalCredits: pools.auditCredits + pools.aiCredits + pools.imageCredits,
    allocations: {
      audit,
      content,
      images,
      ebc,
      competitors,
    },
  };
}

export function computePlanCreditsForSubscription(
  sub: {
    planAuditCredits?: number;
    planAiCredits?: number;
    planImageCredits?: number;
    creditAllocations?: PlanAllocations | Record<string, number> | null;
  },
  rules: CreditRuleLike[] = [],
): PlanCreditsComputed {
  const alloc = sub.creditAllocations;
  const hasStoredAllocations = alloc != null && Object.keys(alloc).length > 0;

  if (hasStoredAllocations) {
    return computePlanCreditsFromAllocations(alloc, rules);
  }

  const legacyPlan: PlanRowForAllocations = {
    auditCredits: sub.planAuditCredits ?? 0,
    aiCredits: sub.planAiCredits ?? 0,
    imageCredits: sub.planImageCredits ?? 0,
    teamMembers: 1,
    creditAllocations: null,
  };
  const counts = allocationCountsFromLegacyPools(legacyPlan);

  return {
    auditCredits: legacyPlan.auditCredits,
    aiCredits: legacyPlan.aiCredits,
    imageCredits: legacyPlan.imageCredits,
    totalCredits: legacyPlan.auditCredits + legacyPlan.aiCredits + legacyPlan.imageCredits,
    allocations: {
      audit: counts.audit,
      content: counts.content,
      images: counts.images,
      ebc: counts.ebc,
      competitors: counts.competitors,
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
