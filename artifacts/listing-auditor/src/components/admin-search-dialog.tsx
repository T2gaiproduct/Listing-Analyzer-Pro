import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Users } from "lucide-react";
import type { RecentItem } from "@workspace/api-client-react";
import type { AdminPermission } from "@workspace/admin-permissions";
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
  filterAdminNavResults,
  listQuickAdminNavLinks,
  type AdminSearchScope,
} from "@/lib/admin-search";
import {
  loadAdminSearchRecents,
  pushAdminSearchRecent,
  type AdminSearchRecent,
} from "@/lib/admin-search-recents";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type AdminSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: AdminSearchScope;
  can: (required: AdminPermission | AdminPermission[]) => boolean;
  canManageCustomers: boolean;
};

function NavResultRow({ name }: { name: string }) {
  return (
    <>
      <LayoutGrid className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="truncate">{name}</span>
    </>
  );
}

function CustomerResultRow({ name }: { name: string }) {
  return (
    <>
      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="truncate">{name}</span>
    </>
  );
}

export function AdminSearchDialog({
  open,
  onOpenChange,
  scope,
  can,
  canManageCustomers,
}: AdminSearchDialogProps) {
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<AdminSearchRecent[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      return;
    }
    setRecentSearches(loadAdminSearchRecents());
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  const customerSearchEnabled =
    canManageCustomers
    && debouncedQuery.length > 0
    && (scope === "all" || scope === "customers");

  const { data: customerData, isFetching: customerFetching } = useQuery({
    queryKey: ["admin-search-dialog-customers", debouncedQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "12", query: debouncedQuery });
      const r = await fetch(`${basePath}/api/admin/customers?${params}`, { credentials: "include" });
      if (!r.ok) {
        return { customers: [] as Array<{ id: string; firstName?: string; lastName?: string; email: string }> };
      }
      return r.json() as Promise<{
        customers: Array<{ id: string; firstName?: string; lastName?: string; email: string }>;
      }>;
    },
    enabled: open && customerSearchEnabled,
    staleTime: 0,
  });

  const navResults = useMemo(
    () => filterAdminNavResults(debouncedQuery, scope, can),
    [debouncedQuery, scope, can],
  );

  const customerResults: RecentItem[] = useMemo(() => {
    if (!customerSearchEnabled) return [];
    return (customerData?.customers ?? []).map((customer, idx) => {
      const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.email;
      return {
        type: "audit" as const,
        id: 2000 + idx,
        name: `Customer · ${name}`,
        url: `/admin/customers/${customer.id}`,
        pinned: false,
      };
    });
  }, [customerData?.customers, customerSearchEnabled]);

  const quickLinks = useMemo(() => listQuickAdminNavLinks(can), [can]);

  const showingResults = query.trim().length > 0;
  const waitingForCustomers =
    showingResults
    && customerSearchEnabled
    && (debouncedQuery !== query.trim() || customerFetching);

  function selectItem(name: string, url: string) {
    pushAdminSearchRecent({ name, url });
    setRecentSearches(loadAdminSearchRecents());
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
            {waitingForCustomers && navResults.length === 0 && (
              <p className="px-4 py-4 text-sm text-muted-foreground text-center">Searching…</p>
            )}

            {showingResults && !waitingForCustomers && navResults.length === 0 && customerResults.length === 0 && debouncedQuery.length > 0 && (
              <CommandEmpty>No matches found</CommandEmpty>
            )}

            {showingResults && navResults.length > 0 && (
              <CommandGroup heading="Admin pages">
                {navResults.map((item) => (
                  <CommandItem
                    key={item.url}
                    value={`nav-${item.url}`}
                    onSelect={() => selectItem(item.name, item.url)}
                    className="mx-2 rounded-lg gap-3 py-2.5 px-3 cursor-pointer"
                  >
                    <NavResultRow name={item.name} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showingResults && customerResults.length > 0 && (
              <CommandGroup heading="Customers">
                {customerResults.map((item) => (
                  <CommandItem
                    key={item.url}
                    value={`customer-${item.url}`}
                    onSelect={() => selectItem(item.name, item.url)}
                    className="mx-2 rounded-lg gap-3 py-2.5 px-3 cursor-pointer"
                  >
                    <CustomerResultRow name={item.name} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!showingResults && recentSearches.length > 0 && (
              <CommandGroup heading="Recent searches">
                {recentSearches.map((item) => (
                  <CommandItem
                    key={`recent-${item.url}`}
                    value={`recent-${item.url}`}
                    onSelect={() => selectItem(item.name, item.url)}
                    className="mx-2 rounded-lg gap-3 py-2.5 px-3 cursor-pointer"
                  >
                    <NavResultRow name={item.name} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!showingResults && quickLinks.length > 0 && (
              <CommandGroup heading="Quick links">
                {quickLinks.map((item) => (
                  <CommandItem
                    key={`quick-${item.url}`}
                    value={`quick-${item.url}`}
                    onSelect={() => selectItem(item.name, item.url)}
                    className="mx-2 rounded-lg gap-3 py-2.5 px-3 cursor-pointer"
                  >
                    <NavResultRow name={item.name} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!showingResults && recentSearches.length === 0 && quickLinks.length === 0 && (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                Search admin pages and customers by name or email.
              </p>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
