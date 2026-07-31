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

/**
 * Admin plan fields are monthly credit allowances (not activity counts).
 * Credit rules apply when users consume credits, not when granting plan pools.
 */
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

/** Legacy plan columns already store monthly credit pools. */
export function allocationCountsFromLegacyPools(plan: {
  auditCredits: number;
  aiCredits: number;
  imageCredits: number;
  teamMembers: number;
}): PlanAllocationCounts {
  return {
    audit: plan.auditCredits,
    content: plan.aiCredits,
    images: plan.imageCredits,
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

/** Feature bullets mirror admin credit fields (monthly allowances). */
export const PLAN_UNLIMITED_CREDIT_VALUE = 999;

export function isUnlimitedPlanCreditValue(value: number): boolean {
  return value === PLAN_UNLIMITED_CREDIT_VALUE || value >= 999999;
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
      isUnlimitedPlanCreditValue(auditsPerMonth)
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
  const counts = allocationCountsFromRecord(allocations, teamMembers);
  const auditCost = await getCreditCost("audit");
  const creditLines = buildPlanCreditFeatureLines(counts, [
    { featureType: "audit", creditsRequired: auditCost.creditsRequired },
  ]);
  return mergePlanFeatureLists(creditLines, existingFeatures ?? []);
}

/** Sync compute for UI when credit rules are already loaded. */
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
  const pools = computePlanPoolsFromAllocationCredits(a);

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

/** DB-backed: sum admin credit allowances into grant pools. */
export async function computePlanPoolsFromAllocations(
  allocations: PlanAllocations | Record<string, number>,
): Promise<PlanCreditPools> {
  return computePlanPoolsFromAllocationCredits(allocations);
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

/** Public/onboarding API: credit columns aligned with credit_allocations. */
export async function serializePlanForPublic<T extends {
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  creditAllocations?: PlanAllocations | Record<string, number> | null;
}>(plan: T): Promise<T> {
  const pools = await resolvePlanCreditPools(plan);
  return {
    ...plan,
    aiCredits: pools.aiCredits,
    imageCredits: pools.imageCredits,
    auditCredits: pools.auditCredits,
  };
}
