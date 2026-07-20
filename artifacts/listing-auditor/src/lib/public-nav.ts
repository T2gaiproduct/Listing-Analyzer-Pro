export interface PublicNavItem {
  id: number;
  label: string;
  href: string;
  location: string;
  sortOrder: number;
  isActive: boolean;
  isCta: boolean;
  opensNewTab: boolean;
}

export const DEFAULT_HEADER_NAV: Pick<PublicNavItem, "label" | "href">[] = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/tutorials", label: "Tutorials" },
  { href: "/ads", label: "Manage Ads" },
  { href: "/contact", label: "Contact" },
];

export const DEFAULT_FOOTER_NAV: Pick<PublicNavItem, "label" | "href">[] = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "About Us", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Tutorials", href: "/tutorials" },
  { label: "Help Center", href: "/help" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

export function navItemsForLocation(items: PublicNavItem[], location: "header" | "footer") {
  return items
    .filter((item) => item.isActive && !item.isCta && (item.location === location || item.location === "both"))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export type NavLink = { id: number; label: string; href: string; opensNewTab: boolean };

export function navCtasForLocation(items: PublicNavItem[], location: "header" | "footer"): NavLink[] {
  return items
    .filter((item) => item.isActive && item.isCta && (item.location === location || item.location === "both"))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((item) => ({ id: item.id, label: item.label, href: item.href, opensNewTab: item.opensNewTab }));
}
