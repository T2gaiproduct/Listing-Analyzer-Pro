import { useEffect, useState } from "react";
import { useLocation } from "wouter";
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
import {
  loadDashboardSearchRecents,
  pushDashboardSearchRecent,
  type DashboardSearchRecent,
} from "@/lib/dashboard-search-recents";

type DashboardSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: RecentItem[];
  recents: RecentItem[];
  searchEnabled: boolean;
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
  searchQuery,
  onSearchQueryChange,
  searchResults,
  recents,
  searchEnabled,
}: DashboardSearchDialogProps) {
  const [, navigate] = useLocation();
  const [recentSearches, setRecentSearches] = useState<DashboardSearchRecent[]>([]);

  useEffect(() => {
    if (open) {
      setRecentSearches(loadDashboardSearchRecents());
    } else {
      onSearchQueryChange("");
    }
  }, [open, onSearchQueryChange]);

  const trimmedQuery = searchQuery.trim();
  const showingResults = trimmedQuery.length > 0;
  const recentProjects = recents.slice(0, 12);

  function selectItem(name: string, url: string) {
    pushDashboardSearchRecent({ name, url });
    setRecentSearches(loadDashboardSearchRecents());
    onSearchQueryChange("");
    onOpenChange(false);
    navigate(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 gap-0 max-w-xl border-border shadow-2xl sm:rounded-xl [&>button]:top-3.5 [&>button]:right-3.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command
          shouldFilter={false}
          className="rounded-xl [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <CommandInput
            placeholder="Search..."
            className="h-12 text-base"
            value={searchQuery}
            onValueChange={onSearchQueryChange}
          />
          <CommandList className="max-h-[min(70vh,28rem)] py-2">
            {!searchEnabled && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                Select a workspace to search projects and listings.
              </p>
            )}

            {searchEnabled && showingResults && searchResults.length === 0 && (
              <CommandEmpty>No matches found</CommandEmpty>
            )}

            {searchEnabled && showingResults && searchResults.length > 0 && (
              <CommandGroup heading="Results">
                {searchResults.map((item) => (
                  <CommandItem
                    key={item.url}
                    value={item.url}
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
                    key={item.url}
                    value={`recent-${item.url}`}
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
                    key={item.url}
                    value={item.url}
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
