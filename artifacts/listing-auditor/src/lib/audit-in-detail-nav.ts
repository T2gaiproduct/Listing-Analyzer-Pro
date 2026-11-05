/** Query `from=` when opening audit detail from the Audit in Detail sidebar tab. */
export const AUDIT_IN_DETAIL_FROM = "audit-in-detail";

export function isOpenedFromAuditInDetail(search: string | undefined): boolean {
  const raw = search ?? "";
  const q = raw.startsWith("?") ? raw.slice(1) : raw;
  return new URLSearchParams(q).get("from") === AUDIT_IN_DETAIL_FROM;
}

export function auditInDetailViewPath(
  auditId: number,
  tab: "overview" | "audit_result" = "overview",
): string {
  const params = new URLSearchParams({ from: AUDIT_IN_DETAIL_FROM, tab });
  return `/audits/${auditId}?${params.toString()}`;
}
