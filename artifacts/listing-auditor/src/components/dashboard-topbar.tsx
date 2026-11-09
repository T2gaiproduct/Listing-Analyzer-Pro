import { Link, useLocation } from "wouter";
import {
  Search, Menu, Archive,
} from "lucide-react";
import { AdminInlineSearch } from "@/components/admin-inline-search";
import { CustomerNotificationBell } from "@/components/customer-notification-bell";
import { AdminNotificationBell } from "@/components/admin-notification-bell";
import type { RecentItem } from "@workspace/api-client-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { ProfileAccountMenu } from "@/components/profile-account-menu";
import { cn } from "@/lib/utils";

interface DashboardTopbarProps {
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
  /** ChatGPT-style command palette (customer shell). */
  onOpenSearch?: () => void;
  /** Legacy inline search (admin). */
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchResults?: RecentItem[];
}

export function DashboardTopbar({
  displayName,
  initials,
  email,
  planLabel,
  roleLabel,
  onMenuClick,
  variant = "customer",
  searchPlaceholder = "Search projects, listings...",
  showProfileMenu = true,
  onOpenSearch,
  searchQuery = "",
  onSearchQueryChange,
  searchResults = [],
}: DashboardTopbarProps) {
  const [, navigate] = useLocation();
  const { isAccountOwner, canView } = useWorkspace();
  const useCommandPalette = variant === "customer" && !!onOpenSearch;
  const adminSearchInSidebar = variant === "admin";
  const useInlineSearch =
    !useCommandPalette && !!onSearchQueryChange && !adminSearchInSidebar;
  const useInlineSearchMobileOnly =
    !useCommandPalette && !!onSearchQueryChange && adminSearchInSidebar;

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

      {useCommandPalette && (
        <button
          type="button"
          onClick={onOpenSearch}
          className="lg:hidden touch-target flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      )}

      {useInlineSearch && (
        <div className="flex-1 min-w-0 max-w-md lg:max-w-lg relative">
          <AdminInlineSearch
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange!}
            searchResults={searchResults}
            searchPlaceholder={searchPlaceholder}
            onNavigate={(url) => navigate(url)}
            theme="light"
          />
        </div>
      )}
      {useInlineSearchMobileOnly && (
        <div className="flex-1 min-w-0 max-w-md relative lg:hidden">
          <AdminInlineSearch
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange!}
            searchResults={searchResults}
            searchPlaceholder={searchPlaceholder}
            onNavigate={(url) => navigate(url)}
            theme="light"
          />
        </div>
      )}

      {useCommandPalette && <div className="flex-1 min-w-0" />}

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

      <div
        className={cn(
          "flex items-center gap-2 sm:gap-4 flex-shrink-0",
          !useInlineSearch && !useInlineSearchMobileOnly && "ml-auto",
          useInlineSearchMobileOnly && "ml-auto lg:ml-0 lg:hidden",
        )}
      >
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

