/** Billing owner in explicit account-overview mode (agency rollup), not a workspace selection. */
export function isAgencyAccountOverviewDashboard(
  isBillingAccountOwner: boolean,
  agencyAccountOverviewActive: boolean,
): boolean {
  return isBillingAccountOwner && agencyAccountOverviewActive;
}
