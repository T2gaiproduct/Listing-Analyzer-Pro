import { useQuery } from "@tanstack/react-query";
import { DEFAULT_FOOTER_NAV, DEFAULT_HEADER_NAV, type PublicNavItem } from "@/lib/public-nav";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchPublicNav(): Promise<PublicNavItem[]> {
  const res = await fetch(`${basePath}/api/nav`);
  if (!res.ok) return [];
  return res.json();
}

function mapNavItems(items: PublicNavItem[], location: "header" | "footer") {
  return items
    .filter((item) => item.isActive && !item.isCta && (item.location === location || item.location === "both"))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((item) => ({ id: item.id, label: item.label, href: item.href, opensNewTab: item.opensNewTab }));
}

export function usePublicNav() {
  const query = useQuery({
    queryKey: ["public-nav"],
    queryFn: fetchPublicNav,
    staleTime: 60_000,
  });

  const items = query.data ?? [];
  const headerFromDb = mapNavItems(items, "header");
  const footerFromDb = mapNavItems(items, "footer");

  const headerLinks = headerFromDb.length > 0
    ? headerFromDb
    : DEFAULT_HEADER_NAV.map((item, index) => ({ id: index, ...item, opensNewTab: false }));

  const footerLinks = footerFromDb.length > 0
    ? footerFromDb
    : DEFAULT_FOOTER_NAV.map((item, index) => ({ id: index, ...item, opensNewTab: false }));

  return { headerLinks, footerLinks, isLoading: query.isLoading };
}
