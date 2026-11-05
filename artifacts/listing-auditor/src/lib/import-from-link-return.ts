/** Query `from=` value when Import from link is opened from Audit Listing tab. */
export const IMPORT_FROM_LINK_AUDIT_LISTINGS = "audit-listings";

export function importFromLinkPath(from?: typeof IMPORT_FROM_LINK_AUDIT_LISTINGS): string {
  if (from === IMPORT_FROM_LINK_AUDIT_LISTINGS) {
    return `/audits/import-from-link?from=${IMPORT_FROM_LINK_AUDIT_LISTINGS}`;
  }
  return "/audits/import-from-link";
}

export function isImportFromLinkForAuditListings(search: string): boolean {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q).get("from") === IMPORT_FROM_LINK_AUDIT_LISTINGS;
}
