import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DEFAULT_IMPORT_LIMIT,
  MAX_IMPORT_PER_RUN,
  fetchCatalogPreview,
  type CatalogPreviewItem,
  type MarketplaceImportInput,
  type MarketplacePlatform,
  type ShopifySyncResult,
} from "@/lib/marketplace-connections";

const PAGE_SIZE = 25;

type MarketplaceImportWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: MarketplacePlatform;
  platformLabel: string;
  marketplace?: string;
  onImport: (input: MarketplaceImportInput) => Promise<ShopifySyncResult>;
  onSuccess: (result: ShopifySyncResult) => void;
};

export function MarketplaceImportWizard({
  open,
  onOpenChange,
  platform,
  platformLabel,
  marketplace,
  onImport,
  onSuccess,
}: MarketplaceImportWizardProps) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importLimit, setImportLimit] = useState(String(DEFAULT_IMPORT_LIMIT));

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setSearchInput("");
    setSearch("");
    setCursor(null);
    setSelectedIds(new Set());
    setImportLimit(String(DEFAULT_IMPORT_LIMIT));
  }, [open, platform]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
      setCursor(null);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const previewQuery = useQuery({
    queryKey: ["marketplace-catalog-preview", platform, page, search, cursor, marketplace],
    queryFn: () => fetchCatalogPreview(platform, {
      page,
      pageSize: PAGE_SIZE,
      search,
      cursor,
      marketplace,
    }),
    enabled: open,
    staleTime: 30_000,
  });

  const items = previewQuery.data?.items ?? [];
  const hasMore = previewQuery.data?.hasMore ?? false;
  const totalHint = previewQuery.data?.totalHint;

  const pageIds = useMemo(() => items.map((item) => item.id), [items]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const importMutation = useMutation({
    mutationFn: onImport,
    onSuccess: (result) => {
      onSuccess(result);
      onOpenChange(false);
    },
  });

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  function handlePrevPage() {
    if (page <= 1) return;
    setPage((p) => p - 1);
  }

  function handleNextPage() {
    if (!hasMore) return;
    if (previewQuery.data?.nextCursor) {
      setCursor(previewQuery.data.nextCursor);
    }
    setPage((p) => p + 1);
  }

  function handleImport() {
    const parsedLimit = Number.parseInt(importLimit, 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(MAX_IMPORT_PER_RUN, Math.max(1, parsedLimit))
      : DEFAULT_IMPORT_LIMIT;

    if (selectedIds.size > 0) {
      importMutation.mutate({
        productIds: Array.from(selectedIds),
        marketplace,
      });
      return;
    }

    importMutation.mutate({
      limit,
      marketplace,
    });
  }

  const importLabel = selectedIds.size > 0
    ? `Import ${selectedIds.size} selected`
    : `Import up to ${importLimit}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Import products from {platformLabel}</DialogTitle>
          <DialogDescription>
            Search your catalog, select specific products, or set a limit to import the first matching items.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, SKU, or handle…"
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                onCheckedChange={() => toggleAllOnPage()}
                aria-label="Select all on page"
              />
              <span>Select page</span>
              {selectedIds.size > 0 ? (
                <span className="text-foreground font-medium">{selectedIds.size} selected</span>
              ) : null}
            </div>
            {totalHint != null ? (
              <span>{totalHint} product{totalHint === 1 ? "" : "s"} found</span>
            ) : null}
          </div>

          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden min-h-[240px]">
            {previewQuery.isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading catalog…
              </div>
            ) : previewQuery.isError ? (
              <div className="px-4 py-10 text-sm text-destructive text-center">
                {previewQuery.error instanceof Error
                  ? previewQuery.error.message
                  : "Could not load catalog preview."}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-sm text-muted-foreground text-center">
                No products match your search.
              </div>
            ) : (
              items.map((item) => (
                <CatalogRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onToggle={() => toggleItem(item.id)}
                />
              ))
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={page <= 1 || previewQuery.isFetching}
              onClick={handlePrevPage}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={!hasMore || previewQuery.isFetching}
              onClick={handleNextPage}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          {selectedIds.size === 0 ? (
            <div className="space-y-2">
              <Label htmlFor="import-limit" className="text-xs text-muted-foreground">
                Import limit (when nothing is selected)
              </Label>
              <Input
                id="import-limit"
                type="number"
                min={1}
                max={MAX_IMPORT_PER_RUN}
                value={importLimit}
                onChange={(e) => setImportLimit(e.target.value)}
                className="h-9 text-sm max-w-[140px]"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={importMutation.isPending || previewQuery.isLoading}
            onClick={handleImport}
          >
            {importMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {importLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatalogRow({
  item,
  selected,
  onToggle,
}: {
  item: CatalogPreviewItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors",
        selected && "bg-orange-50/60",
      )}
      onClick={onToggle}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${item.title}`}
      />
      <div className="w-10 h-10 rounded-md border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Package className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {[item.sku, item.subtitle, item.status].filter(Boolean).join(" · ")}
        </p>
      </div>
    </button>
  );
}
