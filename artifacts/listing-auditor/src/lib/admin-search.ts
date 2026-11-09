import type { RecentItem } from "@workspace/api-client-react";
import type { AdminPermission } from "@workspace/admin-permissions";
import { ADMIN_AI_NAV_ITEMS } from "@/lib/admin-ai-settings-nav";
import { adminNavSections } from "@/lib/admin-nav-sections";

export type AdminSearchScope = "all" | "customers" | "settings" | "billing" | "marketing" | "content" | "reports" | "support";

const ADMIN_NAV_INDEX = [
  ...adminNavSections.flatMap((section) =>
    section.items.map((item) => ({
      name: item.label,
      url: item.href.split("?")[0],
      section: section.label,
      permission: item.permission,
      searchText: `${section.label} ${item.label} ${item.href}`.toLowerCase(),
    })),
  ),
  ...ADMIN_AI_NAV_ITEMS.map((child) => ({
    name: child.label,
    url: child.href,
    section: "Settings",
    permission: "manage_settings" as AdminPermission,
    searchText: `settings ai settings ${child.label} ${child.href}`.toLowerCase(),
  })),
];

export function getAdminSearchContext(location: string): { placeholder: string; scope: AdminSearchScope } {
  const path = location.split("?")[0];
  if (path.startsWith("/admin/settings") || path === "/admin/team-activity") {
    return { placeholder: "Search settings...", scope: "settings" };
  }
  if (path.startsWith("/admin/customers") || path === "/admin/roles") {
    return { placeholder: "Search customers...", scope: "customers" };
  }
  if (
    path.startsWith("/admin/billing")
    || path.startsWith("/admin/plans")
    || path.startsWith("/admin/credit-rules")
    || path === "/admin/credits"
  ) {
    return { placeholder: "Search billing...", scope: "billing" };
  }
  if (path.startsWith("/admin/marketing") || path === "/admin/announcements" || path === "/admin/notifications") {
    return { placeholder: "Search marketing...", scope: "marketing" };
  }
  if (path.startsWith("/admin/content")) {
    return { placeholder: "Search service logs...", scope: "content" };
  }
  if (path.startsWith("/admin/reports")) {
    return { placeholder: "Search reports...", scope: "reports" };
  }
  if (path.startsWith("/admin/help")) {
    return { placeholder: "Search support...", scope: "support" };
  }
  if (path.startsWith("/admin/analytics") || path === "/admin/dashboard") {
    return { placeholder: "Search customers, settings...", scope: "all" };
  }
  return { placeholder: "Search admin...", scope: "all" };
}

function matchesAdminScope(section: string, name: string, scope: AdminSearchScope): boolean {
  switch (scope) {
    case "customers":
      return section === "User Management" || name.toLowerCase().includes("customer");
    case "settings":
      return section === "Settings";
    case "billing":
      return section === "Billing";
    case "marketing":
      return section === "Marketing" || section === "Website CMS";
    case "content":
      return section === "Services";
    case "reports":
      return section === "Reports";
    case "support":
      return section === "Help & Support";
    default:
      return true;
  }
}

export function filterAdminNavResults(
  query: string,
  scope: AdminSearchScope,
  can: (required: AdminPermission | AdminPermission[]) => boolean,
): RecentItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return ADMIN_NAV_INDEX
    .filter((item) => can(item.permission))
    .filter((item) => matchesAdminScope(item.section, item.name, scope) && item.searchText.includes(q))
    .slice(0, 8)
    .map((item, idx) => ({
      type: "audit" as const,
      id: idx + 1,
      name: `${item.section} · ${item.name}`,
      url: item.url,
      pinned: false,
    }));
}

export function listQuickAdminNavLinks(
  can: (required: AdminPermission | AdminPermission[]) => boolean,
): RecentItem[] {
  return ADMIN_NAV_INDEX
    .filter((item) => can(item.permission))
    .slice(0, 8)
    .map((item, idx) => ({
      type: "audit" as const,
      id: idx + 1,
      name: `${item.section} · ${item.name}`,
      url: item.url,
      pinned: false,
    }));
}
