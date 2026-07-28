import { useRef, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, Coins, ChevronDown, UserCircle, Receipt, Settings, HelpCircle,
  Users, LogOut, LifeBuoy, FileText, Download, Keyboard, ScrollText, Lock, Bug, X, Menu,
} from "lucide-react";
import { useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import type { RecentItem } from "@workspace/api-client-react";
import { useTeam } from "@/hooks/use-team";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function profileMenuItems(isTeamMember: boolean, isOwner: boolean, variant: "customer" | "admin") {
  if (variant === "admin") {
    return [
      { icon: Settings, label: "Admin Settings", href: "/admin/settings/platform" },
      { icon: UserCircle, label: "My Profile", href: "/profile" },
    ];
  }
  return [
    { icon: UserCircle, label: "Edit Profile", href: "/profile" },
    { icon: Receipt, label: isTeamMember && !isOwner ? "My Usage" : "Billing", href: "/billing" },
    { icon: Users, label: "Team", href: "/team" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];
}

const helpSubmenuItems = [
  { icon: LifeBuoy, label: "Help center", href: "/help" },
  { icon: FileText, label: "Release notes", href: "/help#release" },
  { icon: Download, label: "Download apps", href: "/help#apps" },
  { icon: Keyboard, label: "Keyboard shortcuts", href: "/help#shortcuts" },
  { icon: ScrollText, label: "Terms of Service", href: "/terms" },
  { icon: Lock, label: "Privacy Policy", href: "/privacy" },
  { icon: Bug, label: "Report a bug", href: "/contact" },
];

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
  onMenuClick,
  variant = "customer",
  searchPlaceholder = "Search projects, listings...",
}: DashboardTopbarProps) {
  const [, navigate] = useLocation();
  const { signOut } = useClerk();
  const { isTeamMember, isOwner } = useTeam();
  const menuItems = profileMenuItems(isTeamMember, isOwner, variant);
  const showCredits = variant === "customer" && !!credits;
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const totalCredits = (credits?.aiCredits ?? 0) + (credits?.imageCredits ?? 0) + (credits?.auditCredits ?? 0);
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
        setHelpOpen(false);
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
        setHelpOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const showSearchResults = searchFocused && searchQuery.length > 0;

  const searchInput = (
    <>
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          placeholder={searchPlaceholder}
          className="w-full h-11 pl-10 pr-3 sm:pr-24 rounded-xl text-sm bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
        />
        <kbd className="absolute right-3 hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded-md">
          Ctrl + K
        </kbd>
      </div>
      {showSearchResults && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
          {searchResults.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No matches found</p>
          ) : (
            searchResults.map((item) => (
              <button
                key={item.url}
                type="button"
                className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors truncate min-h-11"
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
    <header className="flex items-center gap-2 sm:gap-4 h-14 px-4 sm:px-6 bg-white border-b border-slate-200 flex-shrink-0 z-20 min-w-0">
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden touch-target flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Search — icon on xs, inline from sm */}
      <div ref={searchContainerRef} className="flex-1 min-w-0 max-w-2xl relative">
        <button
          type="button"
          className="sm:hidden touch-target flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          aria-label="Search"
          onClick={() => {
            setMobileSearchOpen(true);
            setTimeout(() => searchRef.current?.focus(), 0);
          }}
        >
          <Search className="w-5 h-5" />
        </button>
        {mobileSearchOpen && (
          <div className="sm:hidden fixed inset-x-0 top-14 z-50 bg-white border-b border-slate-200 p-4 shadow-md">
            {searchInput}
          </div>
        )}
        <div className="hidden sm:block">{searchInput}</div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {showCredits && (
        <div ref={creditsRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setCreditsOpen((o) => !o); setProfileOpen(false); }}
            className="flex items-center gap-2 h-11 pl-2.5 sm:pl-3 pr-2.5 rounded-xl bg-orange-50 border border-orange-100 hover:bg-orange-100/80 transition-colors touch-target"
            aria-label={`${totalCredits} credits`}
          >
            <Coins className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div className="text-left hidden sm:block">
              <p className="text-[10px] font-medium text-slate-500 leading-none">Credit Balance</p>
              <p className="text-sm font-bold text-slate-900 leading-tight">{totalCredits.toLocaleString()} Credits</p>
            </div>
            <span className="sm:hidden text-sm font-bold text-slate-900 tabular-nums">{totalCredits.toLocaleString()}</span>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform hidden sm:block", creditsOpen && "rotate-180")} />
          </button>

          {creditsOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-[min(100vw-2rem,14rem)] sm:w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Credit balance</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{totalCredits.toLocaleString()} total</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Your available credits across all types. Unused credits roll over; purchases add to one pool below.
                </p>
              </div>
              <div className="px-4 py-2 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Audit</span>
                  <span className="font-semibold text-slate-900">{credits?.auditCredits ?? 0}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Text Content</span>
                  <span className="font-semibold text-slate-900">{credits?.aiCredits ?? 0}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Images</span>
                  <span className="font-semibold text-slate-900">{credits?.imageCredits ?? 0}</span>
                </div>
              </div>
              <div className="px-2 pt-1 border-t border-slate-100">
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
              </div>
            </div>
          )}
        </div>
        )}

        <div ref={profileRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setProfileOpen((o) => !o); setCreditsOpen(false); setHelpOpen(false); }}
            className={cn(
              "flex items-center gap-2 h-11 pl-1.5 pr-2 rounded-xl transition-colors touch-target",
              profileOpen ? "bg-slate-100" : "hover:bg-slate-50"
            )}
            aria-label="Account menu"
          >
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="text-left hidden md:block min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[7.5rem] lg:max-w-[120px]">{displayName}</p>
              <p className="text-xs text-slate-500 leading-tight truncate max-w-[7.5rem] lg:max-w-[140px]">{profileSubtitle}</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 flex-shrink-0 transition-transform hidden sm:block", profileOpen && "rotate-180")} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-[min(100vw-2rem,14rem)] sm:w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{email}</p>
                  <p className="text-xs text-orange-600 font-medium mt-0.5">{roleLabel}</p>
                  {variant !== "admin" && planLabel && planLabel !== "No plan" && (
                    <p className="text-xs text-slate-400 mt-0.5">{planLabel}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 touch-target"
                  aria-label="Close menu"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="py-1.5">
                {menuItems.map(({ icon: Icon, label, href }) => (
                  <Link key={label} href={href}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left min-h-11"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      {label}
                    </button>
                  </Link>
                ))}
                {variant === "customer" && (
                <div className="relative">
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left min-h-11"
                    onClick={() => setHelpOpen((o) => !o)}
                    aria-expanded={helpOpen}
                  >
                    <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="flex-1 text-left">Help &amp; Support</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", helpOpen && "rotate-180")} />
                  </button>
                  {helpOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/80 py-1 lg:absolute lg:right-full lg:top-0 lg:mr-1 lg:w-52 lg:bg-white lg:border lg:rounded-xl lg:shadow-xl lg:py-1.5 lg:z-[60]">
                      {helpSubmenuItems.map(({ icon: Icon, label, href }) => (
                        <Link key={label} href={href}>
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-3 lg:py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left min-h-11 lg:min-h-0"
                            onClick={() => { setHelpOpen(false); setProfileOpen(false); }}
                          >
                            <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            {label}
                          </button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>
              <div className="border-t border-slate-100 py-1.5">
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
