import { Fragment, ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import { ProfileAccountMenu } from "@/components/profile-account-menu";
import { useQuery } from "@tanstack/react-query";
import { AdminSearchDialog } from "@/components/admin-search-dialog";
import { useUser } from "@clerk/react";
import { Shield, ChevronRight, ChevronDown, Archive, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import type { AdminPermission } from "@workspace/admin-permissions";
import { adminNavSections } from "@/lib/admin-nav-sections";
import { getAdminSearchContext } from "@/lib/admin-search";
import { AdminNotificationBell } from "@/components/admin-notification-bell";
import { useAdminPermissions } from "@/hooks/use-admin-permissions";
import { AdminAiSettingsNavGroup } from "@/components/admin-ai-settings-nav";
import { isAdminAiSettingsPath, isAdminAiSkillEditorPath } from "@/lib/admin-ai-settings-nav";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AdminNavSections({
  location,
  collapsed,
  collapsedSections,
  toggleSection,
  onNavigate,
  can,
  aiSettingsNavOpen,
  onToggleAiSettingsNav,
}: {
  location: string;
  collapsed: boolean;
  collapsedSections: Record<string, boolean>;
  toggleSection: (label: string) => void;
  onNavigate?: () => void;
  can: (required: AdminPermission | AdminPermission[]) => boolean;
  aiSettingsNavOpen: boolean;
  onToggleAiSettingsNav: () => void;
}) {
  const visibleSections = adminNavSections
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
                className="w-full flex items-center justify-between text-[10px] font-medium text-white/60 uppercase tracking-wide mb-1.5 px-3 hover:text-white transition-colors min-h-9"
              >
                <span>{section.label}</span>
                {isSectionCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <p className="text-[10px] font-medium text-white/60 uppercase tracking-wide mb-1.5 px-3">
                {section.label}
              </p>
            ))}
            <div className={cn("space-y-0.5", isSectionCollapsed && "hidden")}>
              {section.items.map((item) => {
                const itemPath = item.href.split("?")[0];
                const isActive = location.startsWith(itemPath);
                const showAiGroupAfterPlatform =
                  section.label === "Settings"
                  && item.href === "/admin/settings/platform"
                  && can("manage_settings");
                return (
                  <Fragment key={item.label}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center rounded-md text-xs font-medium transition-all group min-h-9",
                        collapsed ? "justify-center px-2 py-1.5" : "gap-2.5 px-3 py-1.5",
                        isActive
                          ? "bg-orange-500 text-white shadow-sm"
                          : "text-white/90 hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      <item.icon className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-white" : "text-white/70 group-hover:text-white")} />
                      {!collapsed && item.label}
                      {!collapsed && isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
                    </Link>
                    {showAiGroupAfterPlatform && (
                      <AdminAiSettingsNavGroup
                        location={location}
                        collapsed={collapsed}
                        expanded={aiSettingsNavOpen}
                        onToggle={onToggleAiSettingsNav}
                        onNavigate={onNavigate}
                      />
                    )}
                  </Fragment>
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
  const { user, isLoaded: clerkLoaded } = useUser();
  const { can, defaultRoute } = useAdminPermissions();
  const adminHome = can("view_dashboard") ? "/admin/dashboard" : (defaultRoute || "/admin/dashboard");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [aiSettingsNavOpen, setAiSettingsNavOpen] = useState(true);
  const toggleSection = (label: string) =>
    setCollapsedSections((s) => ({ ...s, [label]: !s[label] }));

  useEffect(() => {
    if (isAdminAiSettingsPath(location)) {
      setAiSettingsNavOpen(true);
    }
  }, [location]);

  const { scope: searchScope } = getAdminSearchContext(location);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchDialogOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { data: profileData } = useQuery<{
    profile: { fullName: string | null } | null;
    accountRole?: { type: string; label: string };
  }>({
    queryKey: ["user-profile-summary"],
    queryFn: () => fetch(`${basePath}/api/profile/summary`, { credentials: "include" }).then((r) => r.json()),
    enabled: clerkLoaded && !!user,
    staleTime: 30_000,
  });

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
  }, [location]);

  return (
    <div className="admin-app-shell flex h-screen w-full bg-slate-50 overflow-hidden">
      <aside className={cn("hidden lg:flex flex-shrink-0 bg-slate-900 text-white flex-col shadow-2xl z-10 transition-[width] duration-200", collapsed ? "w-16" : "w-64")}>
        {collapsed ? (
          <div className="h-auto flex flex-col items-center justify-center gap-1 px-2 py-2 border-b border-slate-700/50">
            <Link href={adminHome} aria-label="Dashboard">
              <Shield className="w-5 h-5 text-orange-400" />
            </Link>
            <button
              type="button"
              title="Search"
              aria-label="Search"
              onClick={() => setSearchDialogOpen(true)}
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors touch-target"
            >
              <Search className="w-4 h-4" />
            </button>
            <AdminNotificationBell
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors touch-target"
            />
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
          <div className="flex flex-col gap-2 px-3 py-2.5 border-b border-slate-700/50">
            <div className="flex items-center gap-2 min-h-9">
            <Link
              href={adminHome}
              aria-label="Admin dashboard"
              className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 hover:bg-slate-700 transition-colors"
            >
              <Shield className="w-5 h-5 text-orange-400" />
            </Link>
            <div className="flex-1 min-w-2" />
            <button
              type="button"
              title="Search"
              aria-label="Search"
              onClick={() => setSearchDialogOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
            <AdminNotificationBell
              className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            />
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
          </div>
        )}

        <nav className={cn("flex-1 py-3 overflow-y-auto", collapsed ? "px-2 space-y-1" : "px-3 space-y-3.5")}>
          <AdminNavSections
            location={location}
            collapsed={collapsed}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            can={can}
            aiSettingsNavOpen={aiSettingsNavOpen}
            onToggleAiSettingsNav={() => setAiSettingsNavOpen((v) => !v)}
          />
        </nav>

        <div className="p-3 border-t border-slate-700/50 space-y-1">
          <ProfileAccountMenu
            displayName={displayName}
            initials={initials}
            email={userEmail}
            planLabel=""
            roleLabel={roleLabel}
            variant="admin"
            collapsed={collapsed}
            dropdownDirection="up"
            layout="sidebar"
            className="w-full"
          />
        </div>
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(100vw-3rem,18rem)] p-0 bg-slate-900 text-slate-100 border-slate-800 flex flex-col lg:hidden">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <div className="flex flex-col gap-2 px-3 py-3 border-b border-slate-700/50">
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
            <button
              type="button"
              title="Search"
              aria-label="Search"
              onClick={() => {
                setMobileNavOpen(false);
                setSearchDialogOpen(true);
              }}
              className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors text-left"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span>Search admin...</span>
            </button>
            <div className="flex items-center gap-1 justify-end">
              <AdminNotificationBell
                onNavigate={() => setMobileNavOpen(false)}
                className="w-9 h-9 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              />
              <Link
                href="/admin/archive"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Archive"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Archive className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <nav className="flex-1 py-3 overflow-y-auto px-3 space-y-3.5">
            <AdminNavSections
              location={location}
              collapsed={false}
              collapsedSections={collapsedSections}
              toggleSection={toggleSection}
              onNavigate={() => setMobileNavOpen(false)}
              can={can}
              aiSettingsNavOpen={aiSettingsNavOpen}
              onToggleAiSettingsNav={() => setAiSettingsNavOpen((v) => !v)}
            />
          </nav>
          <div className="p-3 border-t border-slate-700/50 space-y-1">
            <ProfileAccountMenu
              displayName={displayName}
              initials={initials}
              email={userEmail}
              planLabel=""
              roleLabel={roleLabel}
              variant="admin"
              collapsed={false}
              dropdownDirection="up"
              layout="sidebar"
              className="w-full"
            />
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isAdminAiSkillEditorPath(location) && (
          <>
            <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-amber-400 flex-shrink-0" />
            <DashboardTopbar
              variant="admin"
              displayName={displayName}
              initials={initials}
              email={userEmail}
              planLabel=""
              roleLabel={roleLabel}
              showProfileMenu={false}
              onMenuClick={() => setMobileNavOpen(true)}
              onOpenSearch={() => setSearchDialogOpen(true)}
            />
          </>
        )}
        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50",
            !isAdminAiSkillEditorPath(location) && "app-shell-padding",
          )}
        >
          <div className="app-content-max w-full min-w-0">
            {children}
          </div>
        </div>
      </main>

      <AdminSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        scope={searchScope}
        can={can}
        canManageCustomers={can("manage_customers")}
      />
    </div>
  );
}
