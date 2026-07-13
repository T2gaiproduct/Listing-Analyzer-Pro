import { useRef, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, Coins, ChevronDown, UserCircle, Receipt, Settings, HelpCircle,
  Users, LogOut, LifeBuoy, FileText, Download, Keyboard, ScrollText, Lock, Bug, X,
} from "lucide-react";
import { useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";
import type { RecentItem } from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const profileMenuItems = [
  { icon: UserCircle, label: "Edit Profile", href: "/profile" },
  { icon: Receipt, label: "Billing", href: "/billing" },
  { icon: Users, label: "Team", href: "/team" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

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
  credits: { aiCredits: number; imageCredits: number; auditCredits: number };
}

export function DashboardTopbar({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  displayName,
  initials,
  email,
  planLabel,
  credits,
}: DashboardTopbarProps) {
  const [, navigate] = useLocation();
  const { signOut } = useClerk();
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [searchFocused, setSearchFocused] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const totalCredits = credits.aiCredits + credits.imageCredits + credits.auditCredits;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchFocused(true);
      }
      if (e.key === "Escape") {
        setSearchFocused(false);
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

  return (
    <header className="flex items-center gap-4 h-14 px-6 bg-white border-b border-slate-200 flex-shrink-0 z-20">
      {/* Search */}
      <div ref={searchContainerRef} className="flex-1 max-w-2xl relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search projects, listings, or anything..."
            className="w-full h-10 pl-10 pr-24 rounded-xl text-sm bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
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
                  key={`${item.type}-${item.id}`}
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors truncate"
                  onClick={() => {
                    onSearchQueryChange("");
                    setSearchFocused(false);
                    navigate(item.url);
                  }}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Credits + profile — pinned to the right on wide screens */}
      <div className="ml-auto flex items-center gap-4 flex-shrink-0">
      <div ref={creditsRef} className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => { setCreditsOpen((o) => !o); setProfileOpen(false); }}
          className="flex items-center gap-2.5 h-10 pl-3 pr-2.5 rounded-xl bg-orange-50 border border-orange-100 hover:bg-orange-100/80 transition-colors"
        >
          <Coins className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="text-left hidden sm:block">
            <p className="text-[10px] font-medium text-slate-500 leading-none">Total Credits</p>
            <p className="text-sm font-bold text-slate-900 leading-tight">{totalCredits.toLocaleString()} Credits</p>
          </div>
          <span className="sm:hidden text-sm font-bold text-slate-900">{totalCredits.toLocaleString()}</span>
          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", creditsOpen && "rotate-180")} />
        </button>

        {creditsOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2">
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Credit balance</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{totalCredits.toLocaleString()} total</p>
            </div>
            <div className="px-4 py-2 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Audit</span>
                <span className="font-semibold text-slate-900">{credits.auditCredits}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Text Content</span>
                <span className="font-semibold text-slate-900">{credits.aiCredits}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Images</span>
                <span className="font-semibold text-slate-900">{credits.imageCredits}</span>
              </div>
            </div>
            <div className="px-2 pt-1 border-t border-slate-100">
              <Link href="/billing">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg text-left transition-colors"
                  onClick={() => setCreditsOpen(false)}
                >
                  Buy more credits →
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div ref={profileRef} className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => { setProfileOpen((o) => !o); setCreditsOpen(false); }}
          className={cn(
            "flex items-center gap-2.5 h-10 pl-1.5 pr-2 rounded-xl transition-colors",
            profileOpen ? "bg-slate-100" : "hover:bg-slate-50"
          )}
        >
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="text-left hidden md:block min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[120px]">{displayName}</p>
            <p className="text-xs text-slate-500 leading-tight truncate max-w-[120px]">{planLabel}</p>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-slate-400 flex-shrink-0 transition-transform", profileOpen && "rotate-180")} />
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate">{email}</p>
                <p className="text-xs text-orange-600 font-medium mt-0.5">{planLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="py-1.5">
              {profileMenuItems.map(({ icon: Icon, label, href }) => (
                <Link key={label} href={href}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    {label}
                  </button>
                </Link>
              ))}
              <div
                className="relative"
                onMouseEnter={() => setHelpOpen(true)}
                onMouseLeave={() => setHelpOpen(false)}
              >
                <button type="button" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="flex-1">Help &amp; Support</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 -rotate-90" />
                </button>
                {helpOpen && (
                  <div className="absolute right-full top-0 mr-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-[60]">
                    {helpSubmenuItems.map(({ icon: Icon, label, href }) => (
                      <Link key={label} href={href}>
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left"
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
            </div>
            <div className="border-t border-slate-100 py-1.5">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
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
