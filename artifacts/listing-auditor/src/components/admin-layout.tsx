import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  Users, FileText, BarChart2, CreditCard,
  Layers, Shield, LogOut, ChevronRight, Settings,
  BadgePercent, ClipboardList,
  Bell, BrainCircuit, KeyRound, Lock, Wallet,
  Globe, BookOpen, TrendingUp, MessageSquare, Image, Navigation, Home,
  ChevronDown, ChevronUp, FileSearch, Palette, Archive,
  Video, Megaphone, HelpCircle, Mail, LifeBuoy, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import type { RecentItem } from "@workspace/api-client-react";
import type { AdminPermission } from "@workspace/admin-permissions";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof BarChart2;
  permission: AdminPermission | AdminPermission[];
};

const navSections: Array<{
  label: string;
  collapsible?: boolean;
  items: AdminNavItem[];
}> = [
  {
    label: "Overview",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart2, permission: "view_analytics" },
    ],
  },
  {
    label: "User Management",
    collapsible: true,
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "manage_customers" },
      { href: "/admin/roles", label: "Roles", icon: Shield, permission: "manage_roles" },
    ],
  },
  {
    label: "Services",
    collapsible: true,
    items: [
      { href: "/admin/content/build-brand-logs", label: "Build Your Brand", icon: ClipboardList, permission: "view_logs" },
      { href: "/admin/content/logs", label: "Audit Listing", icon: FileSearch, permission: "view_logs" },
      { href: "/admin/content/graphics-logs", label: "Graphics Creation", icon: Palette, permission: "view_logs" },
      { href: "/videos", label: "Create Videos", icon: Video, permission: "view_logs" },
      { href: "/ads", label: "Manage Ads", icon: Megaphone, permission: "view_logs" },
    ],
  },
  {
    label: "Billing",
    collapsible: true,
    items: [
      { href: "/admin/plans", label: "Plans & Packages", icon: Layers, permission: "manage_plans" },
      { href: "/admin/credit-rules", label: "Credit Rules", icon: Shield, permission: "manage_credit_rules" },
      { href: "/admin/billing/payments", label: "Payments", icon: CreditCard, permission: "manage_payments" },
      { href: "/admin/billing/invoices", label: "Invoices", icon: FileText, permission: "manage_invoices" },
      { href: "/admin/billing/refunds", label: "Refunds", icon: Layers, permission: "manage_refunds" },
    ],
  },
  {
    label: "Reports",
    collapsible: true,
    items: [
      { href: "/admin/reports/revenue", label: "Revenue Reports", icon: BarChart2, permission: "view_reports" },
      { href: "/admin/reports/customers", label: "Customer Reports", icon: Users, permission: "view_reports" },
      { href: "/admin/reports/subscriptions", label: "Subscription Reports", icon: CreditCard, permission: "view_reports" },
    ],
  },
  {
    label: "Marketing",
    collapsible: true,
    items: [
      { href: "/admin/notifications", label: "Announcements", icon: Megaphone, permission: "manage_notifications" },
      { href: "/admin/billing/coupons", label: "Coupons", icon: BadgePercent, permission: "manage_coupons" },
    ],
  },
  {
    label: "Website CMS",
    collapsible: true,
    items: [
      { href: "/admin/marketing/homepage", label: "Homepage", icon: Home, permission: "manage_homepage_cms" },
      { href: "/admin/marketing/pages", label: "Pages", icon: Globe, permission: "manage_pages_cms" },
      { href: "/admin/marketing/navigation", label: "Navigation Menu", icon: Navigation, permission: "manage_navigation" },
      { href: "/admin/marketing/blog", label: "Blog", icon: BookOpen, permission: "manage_blog" },
      { href: "/admin/marketing/seo", label: "SEO", icon: TrendingUp, permission: "manage_seo" },
      { href: "/admin/marketing/testimonials", label: "Testimonials", icon: MessageSquare, permission: "manage_testimonials" },
      { href: "/admin/marketing/faqs", label: "FAQ", icon: HelpCircle, permission: "manage_faqs" },
      { href: "/admin/marketing/media", label: "Media Library", icon: Image, permission: "manage_media" },
    ],
  },
  {
    label: "Help & Support",
    collapsible: true,
    items: [
      { href: "/admin/help/support-tickets", label: "Support Tickets", icon: LifeBuoy, permission: "manage_support" },
      { href: "/admin/marketing/forms?type=contact", label: "Contact Messages", icon: Mail, permission: "manage_support" },
    ],
  },
  {
    label: "Settings",
    collapsible: true,
    items: [
      { href: "/admin/settings/platform", label: "Company Settings", icon: Settings, permission: "manage_settings" },
      { href: "/admin/settings/ai", label: "AI Settings", icon: BrainCircuit, permission: "manage_settings" },
      { href: "/admin/settings/api", label: "Webhook Settings", icon: KeyRound, permission: "manage_settings" },
      { href: "/admin/settings/email", label: "Email Settings", icon: Mail, permission: "manage_settings" },
      { href: "/admin/settings/payment-gateway", label: "Payment Settings", icon: Wallet, permission: "manage_settings" },
      { href: "/admin/settings/security", label: "Security Settings", icon: Lock, permission: "manage_settings" },
      { href: "/admin/team-activity", label: "Team Activity", icon: Users, permission: "manage_team_activity" },
    ],
  },
];

type AdminSearchScope = "all" | "customers" | "settings" | "billing" | "marketing" | "content" | "reports" | "support";

const ADMIN_NAV_INDEX = navSections.flatMap((section) =>
  section.items.map((item) => ({
    name: item.label,
    url: item.href.split("?")[0],
    section: section.label,
    permission: item.permission,
    searchText: `${section.label} ${item.label} ${item.href}`.toLowerCase(),
  })),
);

function getAdminSearchContext(location: string): { placeholder: string; scope: AdminSearchScope } {
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
  if (path.startsWith("/admin/marketing") || path === "/admin/notifications") {
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

function filterAdminNavResults(
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

function AdminNavSections({
  location,
  collapsed,
  collapsedSections,
  toggleSection,
  onNavigate,
  can,
}: {
  location: string;
  collapsed: boolean;
  collapsedSections: Record<string, boolean>;
  toggleSection: (label: string) => void;
  onNavigate?: () => void;
  can: (required: AdminPermission | AdminPermission[]) => boolean;
}) {
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => can(item.permission)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {visibleSections.map((section) => {
        const collapsible = (section as { collapsible?: boolean }).collapsible === true;
        const isSectionCollapsed = !collapsed && collapsible && (collapsedSections[section.label] ?? false);
        return (
          <div key={section.label}>
            {!collapsed && (collapsible ? (
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3 hover:text-slate-300 transition-colors min-h-11"
              >
                <span>{section.label}</span>
                {isSectionCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
                {section.label}
              </p>
            ))}
            <div className={cn("space-y-0.5", isSectionCollapsed && "hidden")}>
              {section.items.map((item) => {
                const itemPath = item.href.split("?")[0];
                const isActive = location.startsWith(itemPath);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center rounded-md text-sm font-medium transition-all group min-h-11",
                      collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                      isActive
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                    {!collapsed && item.label}
                    {!collapsed && isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { can, defaultRoute } = useAdminPermissions();
  const adminHome = can("view_dashboard") ? "/admin/dashboard" : (defaultRoute || "/admin/dashboard");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const toggleSection = (label: string) =>
    setCollapsedSections((s) => ({ ...s, [label]: !s[label] }));

  const { placeholder: searchPlaceholder, scope: searchScope } = getAdminSearchContext(location);

  const { data: profileData } = useQuery<{
    profile: { fullName: string | null } | null;
    accountRole?: { type: string; label: string };
  }>({
    queryKey: ["user-profile-summary"],
    queryFn: () => fetch(`${basePath}/api/profile/summary`, { credentials: "include" }).then((r) => r.json()),
    enabled: clerkLoaded && !!user,
    staleTime: 30_000,
  });

  const { data: searchData } = useQuery({
    queryKey: ["admin-search", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20", query: searchQuery });
      const r = await fetch(`${basePath}/api/admin/customers?${params}`, { credentials: "include" });
      if (!r.ok) return { customers: [] as Array<{ id: string; firstName?: string; lastName?: string; email: string; profileId: number | null }> };
      return r.json() as Promise<{ customers: Array<{ id: string; firstName?: string; lastName?: string; email: string; profileId: number | null }> }>;
    },
    enabled: can("manage_customers") && searchQuery.length > 0 && (searchScope === "all" || searchScope === "customers"),
    staleTime: 0,
  });

  const navSearchResults = filterAdminNavResults(searchQuery, searchScope, can);
  const customerSearchResults: RecentItem[] = can("manage_customers")
    ? (searchData?.customers ?? []).map((customer, idx) => {
      const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.email;
      return {
        type: "audit" as const,
        id: 1000 + idx,
        name: `Customer · ${name}`,
        url: `/admin/customers/${customer.id}`,
        pinned: false,
      };
    })
    : [];
  const searchResults = [...navSearchResults, ...customerSearchResults].slice(0, 12);

  const profileName = profileData?.profile?.fullName?.trim();
  const clerkName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.fullName?.trim() || undefined;
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const displayName = profileName || clerkName || "Admin";
  const initials = (() => {
    const source = profileName || clerkName || userEmail;
    if (source.includes(" ")) {
      const parts = source.split(" ").filter(Boolean);
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return source?.[0]?.toUpperCase() ?? "A";
  })();
  const roleLabel = profileData?.accountRole?.label ?? "Admin";

  useEffect(() => {
    setMobileNavOpen(false);
    setSearchQuery("");
  }, [location]);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <aside className={cn("hidden lg:flex flex-shrink-0 bg-slate-900 text-slate-100 flex-col shadow-2xl z-10 transition-[width] duration-200", collapsed ? "w-16" : "w-64")}>
        {collapsed ? (
          <div className="h-16 flex flex-col items-center justify-center gap-1 px-2 border-b border-slate-700/50">
            <Link href={adminHome} aria-label="Dashboard">
              <Shield className="w-5 h-5 text-orange-400" />
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expand Sidebar"
              aria-label="Expand Sidebar"
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors touch-target"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="h-16 flex items-center gap-2 px-4 border-b border-slate-700/50">
            <Link
              href={adminHome}
              aria-label="Admin dashboard"
              className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 hover:bg-slate-700 transition-colors"
            >
              <Shield className="w-5 h-5 text-orange-400" />
            </Link>
            <div className="flex-1" />
            <Link
              href="/admin/notifications"
              aria-label="Notifications"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Bell className="w-4 h-4" />
            </Link>
            <Link
              href="/admin/archive"
              aria-label="Archive"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Archive className="w-4 h-4" />
            </Link>
            <div className="w-px h-5 bg-slate-700/80" />
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        )}

        <nav className={cn("flex-1 py-4 overflow-y-auto", collapsed ? "px-2 space-y-1" : "px-3 space-y-5")}>
          <AdminNavSections
            location={location}
            collapsed={collapsed}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            can={can}
          />
        </nav>

        <div className="p-3 border-t border-slate-700/50 space-y-1">
          <button
            onClick={() => signOut({ redirectUrl: `${basePath}/` })}
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "flex items-center rounded-md text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full min-h-11",
              collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2 text-left"
            )}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(100vw-3rem,18rem)] p-0 bg-slate-900 text-slate-100 border-slate-800 flex flex-col lg:hidden">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <div className="h-14 flex items-center px-4 border-b border-slate-700/50">
            <Link
              href={adminHome}
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
            >
              <Shield className="w-5 h-5 text-orange-400 flex-shrink-0" />
              <span className="font-bold text-white truncate">
                Super<span className="text-orange-400">Admin</span>
              </span>
            </Link>
          </div>
          <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-5">
            <AdminNavSections
              location={location}
              collapsed={false}
              collapsedSections={collapsedSections}
              toggleSection={toggleSection}
              onNavigate={() => setMobileNavOpen(false)}
              can={can}
            />
          </nav>
          <div className="p-3 border-t border-slate-700/50">
            <button
              onClick={() => signOut({ redirectUrl: `${basePath}/` })}
              className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 w-full min-h-11"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-amber-400 flex-shrink-0" />
        <DashboardTopbar
          variant="admin"
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={searchResults}
          searchPlaceholder={searchPlaceholder}
          displayName={displayName}
          initials={initials}
          email={userEmail}
          planLabel=""
          roleLabel={roleLabel}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <div className="flex-1 overflow-y-auto overflow-x-hidden app-shell-padding bg-slate-50">
          <div className="app-content-max max-w-7xl w-full min-w-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
