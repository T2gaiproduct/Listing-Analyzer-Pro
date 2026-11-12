import { IMPORT_FROM_LINK_AUDIT_LISTINGS } from "@/lib/import-from-link-return";

/** Query `from=` when opening audit detail from the Audit in Detail sidebar sub-tab. */
export const AUDIT_IN_DETAIL_FROM = "audit-in-detail";

/** Same value as import-from-link; opens detail with listing hub tabs from Audit Listing. */
export const AUDIT_LISTING_HISTORY_FROM = IMPORT_FROM_LINK_AUDIT_LISTINGS;

export type AuditListingDetailOpenFrom =
  | typeof AUDIT_IN_DETAIL_FROM
  | typeof AUDIT_LISTING_HISTORY_FROM;

export function parseAuditDetailOpenFrom(
  search: string | undefined,
): AuditListingDetailOpenFrom | null {
  const raw = search ?? "";
  const q = raw.startsWith("?") ? raw.slice(1) : raw;
  const from = new URLSearchParams(q).get("from");
  if (from === AUDIT_IN_DETAIL_FROM) return AUDIT_IN_DETAIL_FROM;
  if (from === AUDIT_LISTING_HISTORY_FROM) return AUDIT_LISTING_HISTORY_FROM;
  return null;
}

export function isOpenedFromAuditInDetail(search: string | undefined): boolean {
  return parseAuditDetailOpenFrom(search) === AUDIT_IN_DETAIL_FROM;
}

export function isOpenedFromAuditListingsHistory(search: string | undefined): boolean {
  return parseAuditDetailOpenFrom(search) === AUDIT_LISTING_HISTORY_FROM;
}

export function isOpenedFromAuditListingDetailHub(search: string | undefined): boolean {
  return parseAuditDetailOpenFrom(search) != null;
}

export function auditListingDetailViewPath(
  auditId: number,
  from: AuditListingDetailOpenFrom,
  tab: "overview" | "audit_result" = "overview",
): string {
  const params = new URLSearchParams({ from, tab });
  return `/audits/${auditId}?${params.toString()}`;
}

export function auditInDetailViewPath(
  auditId: number,
  tab: "overview" | "audit_result" = "overview",
): string {
  return auditListingDetailViewPath(auditId, AUDIT_IN_DETAIL_FROM, tab);
}

/** Audit Listing → existing product picker (`from=` matches import-from-link hub). */
export function auditListingExistingProductWorkflowSearch(): string {
  const params = new URLSearchParams({
    entry: "existing",
    from: AUDIT_LISTING_HISTORY_FROM,
  });
  return `?${params.toString()}`;
}

export function isAuditListingWorkflowSearch(search: string | undefined): boolean {
  return parseAuditDetailOpenFrom(search) === AUDIT_LISTING_HISTORY_FROM;
}
