import { useRef, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, Menu, Building2, Archive,
} from "lucide-react";
import { CustomerNotificationBell } from "@/components/customer-notification-bell";
import { AdminNotificationBell } from "@/components/admin-notification-bell";
import type { RecentItem } from "@workspace/api-client-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspacesPlan } from "@/hooks/use-workspaces-plan";
import { TopbarWorkspaceSwitcher } from "@/components/topbar-workspace-switcher";
import { ProfileAccountMenu } from "@/components/profile-account-menu";

interface DashboardTopbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: RecentItem[];
  displayName: string;
  initials: string;
  email: string;
  planLabel: string;
  roleLabel: string;
  onMenuClick?: () => void;
  variant?: "customer" | "admin";
  searchPlaceholder?: string;
  /** When false, profile menu is rendered elsewhere (e.g. sidebar footer). */
  showProfileMenu?: boolean;
}

export function DashboardTopbar({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  displayName,
  initials,
  email,
  planLabel,
  roleLabel,
  onMenuClick,
  variant = "customer",
  searchPlaceholder = "Search projects, listings...",
  showProfileMenu = true,
}: DashboardTopbarProps) {
  const [, navigate] = useLocation();
  const { isAccountOwner, canView } = useWorkspace();
  const { workspacesPlanLocked, workspacesEnabled, upgradeShort, includedPlansLabel } = useWorkspacesPlan();
  const { activeWorkspace } = useWorkspace();
  const showWorkspaceSwitcher = variant === "customer" && workspacesEnabled;
  const showStaticWorkspaceLabel =
    variant === "customer" && !workspacesEnabled && Boolean(activeWorkspace?.name?.trim());
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchFocused(true);
        setMobileSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchFocused(false);
        setMobileSearchOpen(false);
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
        if (window.innerWidth < 640) setMobileSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const showSearchResults = searchFocused && searchQuery.length > 0;

  const searchInput = (
    <>
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          placeholder={searchPlaceholder}
          className="w-full h-9 pl-9 pr-3 rounded-md text-xs bg-muted/40 border-0 shadow-none text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus:ring-2 focus-visible:ring-2 focus:ring-orange-200/80 focus-visible:ring-orange-200/80"
        />
      </div>
      {showSearchResults && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
          {searchResults.length === 0 ? (
            <p className="px-4 py-2.5 text-xs text-muted-foreground">No matches found</p>
          ) : (
            searchResults.map((item) => (
              <button
                key={item.url}
                type="button"
                className="w-full px-3 py-2 text-left text-xs text-foreground/90 hover:bg-muted transition-colors truncate min-h-9"
                onClick={() => {
                  onSearchQueryChange("");
                  setSearchFocused(false);
                  setMobileSearchOpen(false);
                  navigate(item.url);
                }}
              >
                {item.name}
              </button>
            ))
          )}
        </div>
      )}
    </>
  );

  return (
    <header className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 h-11 px-3 sm:px-5 lg:px-8 bg-card border-b border-border flex-shrink-0 z-20 min-w-0">
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden touch-target flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Search — icon on xs, inline from sm */}
      <div ref={searchContainerRef} className="flex-1 min-w-0 max-w-md lg:max-w-lg relative">
        <button
          type="button"
          className="sm:hidden touch-target flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
          aria-label="Search"
          onClick={() => {
            setMobileSearchOpen(true);
            setTimeout(() => searchRef.current?.focus(), 0);
          }}
        >
          <Search className="w-5 h-5" />
        </button>
        {mobileSearchOpen && (
          <div className="sm:hidden fixed inset-x-0 top-14 z-50 bg-card border-b border-border p-4 shadow-none">
            {searchInput}
          </div>
        )}
        <div className="hidden sm:block">{searchInput}</div>
      </div>

      {showWorkspaceSwitcher && <TopbarWorkspaceSwitcher />}
      {showStaticWorkspaceLabel && (
        <div
          className="hidden sm:flex items-center gap-2 h-10 pl-2.5 pr-2 rounded-md flex-shrink-0 max-w-[min(100%,20rem)] hover:bg-muted/40 transition-colors"
          title={upgradeShort || `Upgrade to ${includedPlansLabel} to enable multiple workspaces`}
        >
          <Building2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <div className="min-w-0 text-left flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 leading-none">Workspace</p>
            <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{activeWorkspace!.name}</p>
          </div>
          {workspacesPlanLocked && isAccountOwner && (
            <Link
              href="/billing"
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-orange-600 hover:text-orange-700 px-2 py-1 rounded-md bg-orange-50/80 hover:bg-orange-100/90 transition-colors"
            >
              Upgrade
            </Link>
          )}
        </div>
      )}

      {variant === "customer" && (
        <div className="flex items-center gap-0.5 lg:hidden flex-shrink-0">
          {(isAccountOwner || canView("notifications")) && (
            <CustomerNotificationBell className="w-9 h-9" />
          )}
          {(isAccountOwner || canView("archive")) && (
            <Link href="/archive" aria-label="Archive">
              <span className="touch-target flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Archive className="w-4 h-4" />
              </span>
            </Link>
          )}
        </div>
      )}
      {variant === "admin" && (
        <div className="flex items-center gap-0.5 lg:hidden flex-shrink-0">
          <AdminNotificationBell className="w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted" />
          <Link href="/admin/archive" aria-label="Archive">
            <span className="touch-target flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Archive className="w-4 h-4" />
            </span>
          </Link>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {showProfileMenu && (
          <ProfileAccountMenu
            displayName={displayName}
            initials={initials}
            email={email}
            planLabel={planLabel}
            roleLabel={roleLabel}
            variant={variant}
            dropdownDirection="down"
            layout="topbar"
            className="w-auto flex-shrink-0"
          />
        )}
      </div>
    </header>
  );
}
