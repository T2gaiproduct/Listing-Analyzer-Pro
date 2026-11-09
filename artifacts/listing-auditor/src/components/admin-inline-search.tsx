import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { RecentItem } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type Props = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: RecentItem[];
  searchPlaceholder: string;
  onNavigate: (url: string) => void;
  theme?: "light" | "dark";
  className?: string;
};

export function AdminInlineSearch({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchPlaceholder,
  onNavigate,
  theme = "light",
  className,
}: Props) {
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const isDark = theme === "dark";

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

  const inputClass = isDark
    ? "w-full h-8 pl-8 pr-2 rounded-md text-[11px] bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
    : "w-full h-9 pl-9 pr-3 rounded-md text-xs bg-muted/40 border-0 shadow-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-200/80";

  const searchInput = (
    <>
      <div className="relative flex items-center">
        <Search
          className={cn(
            "absolute left-2.5 w-3.5 h-3.5 pointer-events-none",
            isDark ? "text-slate-500" : "text-muted-foreground",
          )}
        />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          placeholder={searchPlaceholder}
          className={inputClass}
        />
      </div>
      {showSearchResults && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-1.5 rounded-xl shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto border",
            isDark ? "bg-slate-900 border-slate-700" : "bg-card border-border",
          )}
        >
          {searchResults.length === 0 ? (
            <p className={cn("px-4 py-2.5 text-xs", isDark ? "text-slate-400" : "text-muted-foreground")}>
              No matches found
            </p>
          ) : (
            searchResults.map((item) => (
              <button
                key={item.url}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-xs transition-colors truncate min-h-9",
                  isDark
                    ? "text-slate-200 hover:bg-slate-800"
                    : "text-foreground/90 hover:bg-muted",
                )}
                onClick={() => {
                  onSearchQueryChange("");
                  setSearchFocused(false);
                  setMobileSearchOpen(false);
                  onNavigate(item.url);
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
    <div ref={searchContainerRef} className={cn("relative w-full min-w-0", className)}>
      {theme === "light" && (
        <>
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
        </>
      )}
      {theme === "dark" && searchInput}
    </div>
  );
}
