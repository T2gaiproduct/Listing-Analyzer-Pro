import type { WorkspaceFeature } from "@workspace/workspace-permissions";

/** Live customer site — hide unreleased sidebar modules here only. */
const ECOMM_GURU_PRODUCTION_HOSTS = new Set(["ecomm-guru.com", "www.ecomm-guru.com"]);

const HIDDEN_FEATURES_ON_PRODUCTION = new Set<WorkspaceFeature>([
  "videos",
  "ads",
  "sellermate_ai",
]);

export function isEcommGuruProductionSite(hostname?: string): boolean {
  const h = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();
  return ECOMM_GURU_PRODUCTION_HOSTS.has(h);
}

export function isEcommGuruProductionNavHiddenFeature(feature: WorkspaceFeature): boolean {
  if (!isEcommGuruProductionSite()) return false;
  return HIDDEN_FEATURES_ON_PRODUCTION.has(feature);
}

export function isEcommGuruProductionRestrictedPath(pathname: string): boolean {
  if (!isEcommGuruProductionSite()) return false;
  const p = pathname.split("?")[0] ?? pathname;
  if (p === "/ai" || p === "/videos") return true;
  return p === "/ads" || p.startsWith("/ads/");
}