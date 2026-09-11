import { useRef, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, Coins, ChevronDown, UserCircle, Receipt, Settings,
  Users, LogOut, Lock, X, Menu, Building2, Shield,
} from "lucide-react";
import { useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import type { RecentItem } from "@workspace/api-client-react";
import { useTeam } from "@/hooks/use-team";
import { useWorkspace } from "@/hooks/use-workspace";
import { buildProfileMenuItems } from "@/lib/profile-menu-items";
import { useWorkspacesPlan } from "@/hooks/use-workspaces-plan";
import { TopbarWorkspaceSwitcher } from "@/components/topbar-workspace-switcher";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function profileMenuItems(
  isTeamMember: boolean,
  isOwner: boolean,
  isAccountOwner: boolean,
  isWorkspaceAccountOwner: boolean,
  variant: "customer" | "admin",
  canView: ReturnType<typeof useWorkspace>["canView"],
  can: ReturnType<typeof useWorkspace>["can"],
  workspacesPlanLocked: boolean,
) {
  return buildProfileMenuItems(
    isTeamMember,
    isOwner,
    isAccountOwner,
    isWorkspaceAccountOwner,
    variant,
    canView,
    can,
    workspacesPlanLocked,
  );
}

interface DashboardTopbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: RecentItem[];
  displayName: string;
  initials: string;
  email: string;
  planLabel: string;
  roleLabel: string;
  credits?: { aiCredits: number; imageCredits: number; auditCredits: number };
  creditsScopeLabel?: "workspace" | "member" | "account" | "account_hub" | "account_total";
  accountCreditSummary?: {
    unallocatedTotal: number;
    inPoolsTotal: number;
    accountTotal: number;
    unallocated?: { aiCredits: number; imageCredits: number; auditCredits: number };
    accountTotalBuckets?: { aiCredits: number; imageCredits: number; auditCredits: number };
    workspaceCreditsAllocatedTotal?: number;
  };
  /** When scoped to a client workspace — pill subtitle and manage link. */
  workspaceScopeName?: string | null;
  workspaceManageHref?: string | null;
  onMenuClick?: () => void;
  variant?: "customer" | "admin";
  searchPlaceholder?: string;
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
  credits,
  creditsScopeLabel = "account",
  accountCreditSummary,
  workspaceScopeName,
  workspaceManageHref,
  onMenuClick,
  variant = "customer",
  searchPlaceholder = "Search projects, listings...",
}: DashboardTopbarProps) {
  const [, navigate] = useLocation();
  const { signOut } = useClerk();
  const { isTeamMember, isOwner } = useTeam();
  const { isAccountOwner, isWorkspaceAccountOwner, canView, can } = useWorkspace();
  const { workspacesPlanLocked } = useWorkspacesPlan();
  const menuItems = profileMenuItems(
    isTeamMember,
    isOwner,
    isAccountOwner,
    isWorkspaceAccountOwner,
    variant,
    canView,
    can,
    workspacesPlanLocked,
  );
  const showWorkspaceSwitcher = variant === "customer";
  const showCredits = variant === "customer" && !!credits;
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const totalCredits = (credits?.aiCredits ?? 0) + (credits?.imageCredits ?? 0) + (credits?.auditCredits ?? 0);
  const creditBalanceLabel =
    creditsScopeLabel === "workspace"
      ? (workspaceScopeName?.trim() || "Workspace")
      : creditsScopeLabel === "account_hub"
        ? "Available to fund"
        : creditsScopeLabel === "account_total"
          ? "Credit balance"
          : "Credit balance";
  const creditBalanceHeadline =
    creditsScopeLabel === "account_total" && accountCreditSummary
      ? accountCreditSummary.unallocatedTotal
      : creditsScopeLabel === "account_hub" && accountCreditSummary
        ? accountCreditSummary.unallocatedTotal
        : accountCreditSummary && creditsScopeLabel === "account"
          ? accountCreditSummary.unallocatedTotal
          : totalCredits;

  const breakdownCredits =
    creditsScopeLabel === "workspace" || creditsScopeLabel === "member"
      ? credits
      : creditsScopeLabel === "account_total" && accountCreditSummary?.unallocated
        ? accountCreditSummary.unallocated
        : creditsScopeLabel === "account_hub" && accountCreditSummary?.unallocated
          ? accountCreditSummary.unallocated
          : accountCreditSummary?.unallocated ?? credits;

  const typeBreakdownRows = [
    { label: "Audit", value: breakdownCredits?.auditCredits ?? 0 },
    { label: "Text", value: breakdownCredits?.aiCredits ?? 0 },
    { label: "Images", value: breakdownCredits?.imageCredits ?? 0 },
  ];
  const profileSubtitle = variant === "admin"
    ? roleLabel
    : planLabel && planLabel !== "No plan"
      ? `${roleLabel} · ${planLabel}`
      : roleLabel;

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
        setCreditsOpen(false);
        setProfileOpen(false);
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
      if (creditsRef.current && !creditsRef.current.contains(e.target as Node)) {
        setCreditsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
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
          className="w-full h-9 pl-9 pr-3 sm:pr-20 rounded-lg text-xs bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus:ring-2 focus-visible:ring-2 focus:ring-orange-200 focus-visible:ring-orange-200 focus:border-orange-400 focus-visible:border-orange-400"
        />
        <kbd className="absolute right-3 hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground bg-card border border-border rounded-md">
          Ctrl + K
        </kbd>
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
    <header className="flex items-center gap-2.5 sm:gap-3 h-11 px-5 sm:px-6 lg:px-8 bg-card border-b border-border flex-shrink-0 z-20 min-w-0">
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
          <div className="sm:hidden fixed inset-x-0 top-14 z-50 bg-card border-b border-border p-4 shadow-md">
            {searchInput}
          </div>
        )}
        <div className="hidden sm:block">{searchInput}</div>
      </div>

      {showWorkspaceSwitcher && <TopbarWorkspaceSwitcher />}

      <div className="ml-auto flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {showCredits && (
        <div ref={creditsRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setCreditsOpen((o) => !o); setProfileOpen(false); }}
            className="flex items-center gap-2 h-9 pl-2 sm:pl-2.5 pr-2 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15 transition-colors touch-target"
            aria-label={`${creditBalanceHeadline} credits`}
          >
            <Coins className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div className="text-left hidden sm:block">
              <p className="text-[10px] font-medium text-muted-foreground leading-none">
                {creditBalanceLabel}
              </p>
              <p className="text-xs font-semibold text-foreground leading-tight">{creditBalanceHeadline.toLocaleString()} Credits</p>
            </div>
            <span className="sm:hidden text-xs font-semibold text-foreground tabular-nums">{creditBalanceHeadline.toLocaleString()}</span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform hidden sm:block", creditsOpen && "rotate-180")} />
          </button>

          {creditsOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-[min(100vw-2rem,15rem)] sm:w-60 bg-card border border-border rounded-xl shadow-xl z-50 py-2">
              <div className="px-4 py-2 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {creditsScopeLabel === "workspace"
                    ? (workspaceScopeName?.trim() || "This workspace")
                    : creditsScopeLabel === "member"
                      ? "Your credits"
                      : creditsScopeLabel === "account_hub"
                        ? "Available on account"
                        : creditsScopeLabel === "account_total"
                          ? "Credit balance"
                          : "Credit balance"}
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">
                  {creditBalanceHeadline.toLocaleString()}
                  <span className="text-sm font-semibold text-muted-foreground">
                    {creditsScopeLabel === "account_hub" ? " available" : " remaining"}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {creditsScopeLabel === "workspace"
                    ? "Credits in this workspace pool (spend and assign from Workspaces)."
                    : creditsScopeLabel === "member"
                      ? "Credits allocated to you in this workspace by your admin."
                      : creditsScopeLabel === "account_hub"
                        ? "Not yet moved into client workspace pools."
                        : creditsScopeLabel === "account_total"
                          ? "On your account — fund workspaces or spend from your account balance."
                          : "Credits available on your account."}
                </p>
                {accountCreditSummary && creditsScopeLabel === "account_total" && (
                  <div className="mt-2 pt-2 border-t border-border space-y-1.5 text-[11px] text-muted-foreground">
                    <div className="flex justify-between gap-2">
                      <span>Allocated to workspaces</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {(accountCreditSummary.workspaceCreditsAllocatedTotal ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground/90">
                      Total funded to workspaces this billing period (manage on Workspaces).
                    </p>
                  </div>
                )}
              </div>
              <div className="px-4 py-2 space-y-1.5 text-sm border-b border-border">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pb-0.5">
                  {creditsScopeLabel === "account_total" ? "By type (on your account)" : "By type"}
                </p>
                {typeBreakdownRows.map((row) => (
                  <div key={row.label} className="flex justify-between text-muted-foreground">
                    <span>{row.label}</span>
                    <span className="font-semibold text-foreground tabular-nums">{row.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="px-2 pt-1 space-y-0.5">
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg text-left transition-colors min-h-11"
                  onClick={() => {
                    setCreditsOpen(false);
                    navigate(
                      isTeamMember && !isOwner
                        ? "/billing"
                        : "/billing?tab=credits",
                    );
                  }}
                >
                  {isTeamMember && !isOwner
                    ? "View usage →"
                    : "Buy more credits →"}
                </button>
                {creditsScopeLabel === "workspace" && workspaceManageHref && (
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-muted rounded-lg text-left transition-colors min-h-11"
                    onClick={() => {
                      setCreditsOpen(false);
                      navigate(workspaceManageHref);
                    }}
                  >
                    Manage workspace →
                  </button>
                )}
                {creditsScopeLabel === "account_total" && (
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-muted rounded-lg text-left transition-colors min-h-11"
                    onClick={() => {
                      setCreditsOpen(false);
                      navigate("/workspaces");
                    }}
                  >
                    Manage workspaces →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        )}

        <div ref={profileRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setProfileOpen((o) => !o); setCreditsOpen(false); }}
            className={cn(
              "flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-lg transition-colors touch-target",
              profileOpen ? "bg-muted" : "hover:bg-muted"
            )}
            aria-label="Account menu"
          >
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="text-left hidden md:block min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight truncate max-w-[7.5rem] lg:max-w-[120px]">{displayName}</p>
              <p className="text-[11px] text-muted-foreground leading-tight truncate max-w-[7.5rem] lg:max-w-[140px]">{profileSubtitle}</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform hidden sm:block", profileOpen && "rotate-180")} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-[min(100vw-2rem,14rem)] sm:w-56 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
                  <p className="text-xs text-orange-600 font-medium mt-0.5">{roleLabel}</p>
                  {variant !== "admin" && planLabel && planLabel !== "No plan" && (
                    <p className="text-xs text-muted-foreground mt-0.5">{planLabel}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground touch-target"
                  aria-label="Close menu"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="py-1.5">
                {menuItems.map(({ icon: Icon, label, href, locked, lockedHint }) => (
                  locked ? (
                    <div
                      key={label}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground cursor-not-allowed min-h-11"
                      title={lockedHint ?? "Upgrade your plan to unlock"}
                    >
                      <Icon className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                      <span className="flex-1 min-w-0">
                        {label}
                        {lockedHint && (
                          <span className="block text-[10px] text-amber-700 font-medium mt-0.5">{lockedHint}</span>
                        )}
                      </span>
                      <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    </div>
                  ) : (
                    <Link key={label} href={href}>
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground/90 hover:bg-muted transition-colors text-left min-h-11"
                        onClick={() => setProfileOpen(false)}
                      >
                        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        {label}
                      </button>
                    </Link>
                  )
                ))}
              </div>
              <div className="border-t border-border py-1.5">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors text-left min-h-11"
                  onClick={() => signOut({ redirectUrl: `${basePath}/` })}
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
