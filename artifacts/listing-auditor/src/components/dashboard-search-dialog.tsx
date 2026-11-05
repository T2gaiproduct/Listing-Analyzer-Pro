import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import type { RecentItem } from "@workspace/api-client-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { fetchJson } from "@/lib/api-fetch";
import {
  loadDashboardSearchRecents,
  pushDashboardSearchRecent,
  type DashboardSearchRecent,
} from "@/lib/dashboard-search-recents";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type DashboardSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recents: RecentItem[];
  searchEnabled: boolean;
  featureWorkspaceId: number | null;
};

function SearchResultRow({ name }: { name: string }) {
  return (
    <>
      <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="truncate">{name}</span>
    </>
  );
}

export function DashboardSearchDialog({
  open,
  onOpenChange,
  recents,
  searchEnabled,
  featureWorkspaceId,
}: DashboardSearchDialogProps) {
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<DashboardSearchRecent[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      return;
    }
    setRecentSearches(loadDashboardSearchRecents());
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  const { data: searchData, isFetching: searchFetching } = useQuery({
    queryKey: ["search-projects", debouncedQuery, featureWorkspaceId],
    queryFn: async () =>
      fetchJson<{ items: RecentItem[] }>(
        `${basePath}/api/search/projects?q=${encodeURIComponent(debouncedQuery)}&limit=50`,
      ),
    enabled: open && searchEnabled && debouncedQuery.length > 0,
    staleTime: 0,
  });

  const searchResults = searchData?.items ?? [];
  const showingResults = query.trim().length > 0;
  const recentProjects = recents.slice(0, 12);
  const waitingForResults =
    showingResults
    && debouncedQuery.length > 0
    && (debouncedQuery !== query.trim() || searchFetching);

  function selectItem(name: string, url: string) {
    pushDashboardSearchRecent({ name, url });
    setRecentSearches(loadDashboardSearchRecents());
    setQuery("");
    setDebouncedQuery("");
    onOpenChange(false);
    navigate(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 gap-0 max-w-xl border-border shadow-2xl sm:rounded-xl [&>button]:top-3.5 [&>button]:right-3.5">
        <Command
          shouldFilter={false}
          className="rounded-xl [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <CommandInput
            ref={inputRef}
            placeholder="Search..."
            className="h-12 text-base"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(70vh,28rem)] py-2">
            {!searchEnabled && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                Select a workspace to search projects and listings.
              </p>
            )}

            {searchEnabled && waitingForResults && (
              <p className="px-4 py-4 text-sm text-muted-foreground text-center">Searching…</p>
            )}

            {searchEnabled && showingResults && !waitingForResults && searchResults.length === 0 && debouncedQuery.length > 0 && (
              <CommandEmpty>No matches found</CommandEmpty>
            )}

            {searchEnabled && showingResults && !waitingForResults && searchResults.length > 0 && (
              <CommandGroup heading="Results">
                {searchResults.map((item) => (
                  <CommandItem
                    key={item.url}
                    value={`result-${item.url}`}
                    onSelect={() => selectItem(item.name, item.url)}
                    className="mx-2 rounded-lg gap-3 py-2.5 px-3 cursor-pointer"
                  >
                    <SearchResultRow name={item.name} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchEnabled && !showingResults && recentSearches.length > 0 && (
              <CommandGroup heading="Recent searches">
                {recentSearches.map((item) => (
                  <CommandItem
                    key={`recent-search-${item.url}`}
                    value={`recent-search-${item.url}`}
                    onSelect={() => selectItem(item.name, item.url)}
                    className="mx-2 rounded-lg gap-3 py-2.5 px-3 cursor-pointer"
                  >
                    <SearchResultRow name={item.name} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchEnabled && !showingResults && recentProjects.length > 0 && (
              <CommandGroup heading="Recent projects">
                {recentProjects.map((item) => (
                  <CommandItem
                    key={`recent-project-${item.url}`}
                    value={`recent-project-${item.url}`}
                    onSelect={() => selectItem(item.name, item.url)}
                    className="mx-2 rounded-lg gap-3 py-2.5 px-3 cursor-pointer"
                  >
                    <SearchResultRow name={item.name} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchEnabled && !showingResults && recentSearches.length === 0 && recentProjects.length === 0 && (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                Search projects and listings by name, or open something to see it here.
              </p>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
