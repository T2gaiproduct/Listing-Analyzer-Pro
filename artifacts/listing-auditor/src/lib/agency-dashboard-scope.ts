/** Billing owner in explicit account-overview mode (agency rollup), not a workspace selection. */
export function isAgencyAccountOverviewDashboard(
  isBillingAccountOwner: boolean,
  agencyAccountOverviewActive: boolean,
): boolean {
  return isBillingAccountOwner && agencyAccountOverviewActive;
}

/** Paths that should omit x-workspace-id and use account-scoped list APIs in agency overview. */
export function pathUsesAgencyAccountWideApiScope(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  if (p === "/" || p === "/dashboard") return true;
  if (p === "/recent-projects") return true;
  if (p === "/products" || p.startsWith("/products/")) return true;
  if (p === "/archive") return true;
  if (p === "/projects") return true;
  if (p.startsWith("/projects/")) return false;
  return false;
}
