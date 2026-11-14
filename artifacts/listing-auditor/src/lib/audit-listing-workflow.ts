import {
  AUDIT_LISTING_HISTORY_FROM,
  parseAuditDetailOpenFrom,
} from "@/lib/audit-in-detail-nav";

/** Query flag on `/audits/workflow` for Audit Listing → existing product. */
export const AUDIT_LISTING_WORKFLOW_FLOW = "audit-listing";

const SESSION_KEY = "ecommguru-audit-listing-workflow";

export function markAuditListingWorkflowIntent(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* private mode / blocked storage */
  }
}

export function clearAuditListingWorkflowIntent(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function hasAuditListingWorkflowSessionIntent(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Prefer live `window.location.search` (wouter can lag right after navigate). */
export function resolveWorkflowSearchString(fallbackSearch: string | undefined): string {
  if (typeof window !== "undefined") {
    const live = window.location.search;
    if (live) return live;
  }
  const raw = fallbackSearch ?? "";
  if (!raw) return "";
  return raw.startsWith("?") ? raw : `?${raw}`;
}

export function workflowSearchParams(search: string | undefined): URLSearchParams {
  const raw = resolveWorkflowSearchString(search);
  const q = raw.startsWith("?") ? raw.slice(1) : raw;
  return new URLSearchParams(q);
}

/** True when Audit Listing opened the existing-product picker (not Build Your Brand). */
export function isAuditListingExistingProductWorkflow(search: string | undefined): boolean {
  const params = workflowSearchParams(search);
  if (params.get("flow") === AUDIT_LISTING_WORKFLOW_FLOW) return true;
  if (parseAuditDetailOpenFrom(resolveWorkflowSearchString(search)) === AUDIT_LISTING_HISTORY_FROM) {
    return true;
  }
  if (params.get("entry") === "existing" && hasAuditListingWorkflowSessionIntent()) return true;
  return false;
}

export function auditListingExistingProductWorkflowQuery(): string {
  const params = new URLSearchParams({
    entry: "existing",
    from: AUDIT_LISTING_HISTORY_FROM,
    flow: AUDIT_LISTING_WORKFLOW_FLOW,
  });
  return params.toString();
}

export function isAuditListingWorkflowPath(location: string, search = ""): boolean {
  return location === "/audits/workflow" && isAuditListingExistingProductWorkflow(search);
}
