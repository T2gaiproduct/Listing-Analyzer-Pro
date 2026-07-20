import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_FOOTER_NAV,
  DEFAULT_HEADER_NAV,
  navCtasForLocation,
  navItemsForLocation,
  type NavLink,
  type PublicNavItem,
} from "@/lib/public-nav";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchPublicNav(): Promise<PublicNavItem[]> {
  const res = await fetch(`${basePath}/api/nav`);
  if (!res.ok) return [];
  return res.json();
}

function mapNavLinks(items: PublicNavItem[], location: "header" | "footer"): NavLink[] {
  return navItemsForLocation(items, location).map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    opensNewTab: item.opensNewTab,
  }));
}

function hasLocationConfig(items: PublicNavItem[], location: "header" | "footer") {
  return items.some((item) => item.isActive && (item.location === location || item.location === "both"));
}

export function usePublicNav() {
  const query = useQuery({
    queryKey: ["public-nav"],
    queryFn: fetchPublicNav,
    staleTime: 60_000,
  });

  const items = query.data ?? [];
  const headerFromDb = mapNavLinks(items, "header");
  const footerFromDb = mapNavLinks(items, "footer");
  const headerCtas = navCtasForLocation(items, "header");
  const footerCtas = navCtasForLocation(items, "footer");

  const headerLinks = hasLocationConfig(items, "header")
    ? headerFromDb
    : DEFAULT_HEADER_NAV.map((item, index) => ({ id: index, ...item, opensNewTab: false }));

  const footerLinks = hasLocationConfig(items, "footer")
    ? [...footerFromDb, ...footerCtas]
    : DEFAULT_FOOTER_NAV.map((item, index) => ({ id: index, ...item, opensNewTab: false }));

  return { headerLinks, footerLinks, headerCtas, footerCtas, isLoading: query.isLoading };
}
