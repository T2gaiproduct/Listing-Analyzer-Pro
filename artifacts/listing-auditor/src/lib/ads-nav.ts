import type { LucideIcon } from "lucide-react";
import {
  Ban,
  MapPin,
  Megaphone,
  Package,
  Search,
  Settings2,
  Target,
} from "lucide-react";

export type ManageAdsNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export const MANAGE_ADS_HOME_HREF = "/ads";

export const MANAGE_ADS_NAV_ITEMS: ManageAdsNavItem[] = [
  { href: "/ads/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/ads/targets", label: "Targets", icon: Target },
  { href: "/ads/search-terms", label: "Search Terms", icon: Search },
  { href: "/ads/products", label: "Ads Products", icon: Package },
  { href: "/ads/placements", label: "Placements", icon: MapPin },
  { href: "/ads/negative-targets", label: "Negative Targets", icon: Ban },
  { href: "/ads/campaign-manager", label: "Campaign Manager", icon: Settings2 },
];

export function isManageAdsPath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p === "/ads" || p.startsWith("/ads/");
}

export function isManageAdsConsolePath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  if (p === MANAGE_ADS_HOME_HREF) return false;
  return MANAGE_ADS_NAV_ITEMS.some((item) => p === item.href || p.startsWith(`${item.href}/`));
}

export function isManageAdsHomePath(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p === MANAGE_ADS_HOME_HREF;
}
