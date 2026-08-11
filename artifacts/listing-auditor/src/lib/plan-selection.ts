export const ONBOARDING_PLAN_STORAGE_KEY = "onboarding-selected-plan-id";
export const ONBOARDING_BILLING_STORAGE_KEY = "onboarding-selected-billing";

export function coercePlanId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readSavedPlanId(): number | null {
  try {
    const saved = sessionStorage.getItem(ONBOARDING_PLAN_STORAGE_KEY);
    if (!saved) return null;
    return coercePlanId(saved);
  } catch {
    return null;
  }
}

export function readSavedBillingYearly(): boolean | null {
  try {
    const saved = sessionStorage.getItem(ONBOARDING_BILLING_STORAGE_KEY);
    if (saved === "yearly") return true;
    if (saved === "monthly") return false;
    return null;
  } catch {
    return null;
  }
}

export function persistPlanSelection(planId: number, yearly = false): void {
  try {
    sessionStorage.setItem(ONBOARDING_PLAN_STORAGE_KEY, String(planId));
    sessionStorage.setItem(ONBOARDING_BILLING_STORAGE_KEY, yearly ? "yearly" : "monthly");
  } catch {
    // sessionStorage may be unavailable in private browsing
  }
}

export function buildSignUpHref(planId: number, yearly = false): string {
  persistPlanSelection(planId, yearly);
  const params = new URLSearchParams();
  params.set("plan", String(planId));
  if (yearly) params.set("billing", "yearly");
  return `/sign-up?${params.toString()}`;
}

export function appendPlanSelectionToPath(path: string, planId?: number | null, yearly?: boolean): string {
  if (planId == null) return path;
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("plan", String(planId));
  if (yearly) params.set("billing", "yearly");
  else params.delete("billing");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
