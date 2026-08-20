import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdsConsoleLayout } from "@/components/ads-console-layout";
import {
  AdsConsoleTableShell,
  AdsConsoleToolbar,
  adsStateBadge,
} from "@/components/ads-console-toolbar";
import { fetchAdsStatusForDemo } from "@/lib/ads-api";
import {
  bulkUpdateAdsProductAds,
  defaultCampaignDateRange,
  fetchAdsConsoleProductAds,
  type AdsConsoleProductAdsQuery,
} from "@/lib/ads-console-api";
import { enableAdsConsoleDemoInUrl, isAdsConsoleDemoMode } from "@/lib/ads-console-demo";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function buildStateFilter(d: {
  enabled: boolean;
  paused: boolean;
  archived: boolean;
}): string {
  const states: string[] = [];
  if (d.enabled) states.push("ENABLED");
  if (d.paused) states.push("PAUSED");
  if (d.archived) states.push("ARCHIVED");
  return states.join(",");
}

export default function AdsProductsConsolePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [demoMode, setDemoMode] = useState(() => isAdsConsoleDemoMode());
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const defaultRange = defaultCampaignDateRange();
  const [draftFilters, setDraftFilters] = useState({
    dateFrom: defaultRange.dateFrom,
    dateTo: defaultRange.dateTo,
    name: "",
    enabled: true,
    paused: true,
    archived: false,
  });
  const [activeFilters, setActiveFilters] = useState<AdsConsoleProductAdsQuery | null>(null);

  const statusQuery = useQuery({
    queryKey: ["ads-status", demoMode],
    queryFn: () => fetchAdsStatusForDemo(demoMode),
  });

  useEffect(() => {
    if (filtersApplied) return;
    if (!demoMode && !statusQuery.data?.canGatherData) return;
    const states = buildStateFilter(draftFilters);
    setActiveFilters({
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      state: states,
    });
    setFiltersApplied(true);
  }, [demoMode, statusQuery.data?.canGatherData, filtersApplied]);

  const queryParams: AdsConsoleProductAdsQuery | null = activeFilters
    ? { ...activeFilters, page, pageSize, sort: "adName", demo: demoMode }
    : null;

  const productsQuery = useQuery({
    queryKey: ["ads-console-product-ads", demoMode, queryParams],
    queryFn: () => fetchAdsConsoleProductAds(queryParams!),
    enabled: (statusQuery.data?.canGatherData === true || demoMode) && filtersApplied && queryParams != null,
    retry: false,
  });

  const bulkMutation = useMutation({
    mutationFn: bulkUpdateAdsProductAds,
    onSuccess: (data) => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["ads-console-product-ads"] });
      toast({
        title: data.updated > 0 ? "Bulk action applied" : "No product ads updated",
        description: data.errors.length ? data.errors.join("; ") : undefined,
        variant: data.errors.length && data.updated === 0 ? "destructive" : "default",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Bulk action failed", description: err.message, variant: "destructive" }),
  });

  const productAds = productsQuery.data?.productAds ?? [];
  const total = productsQuery.data?.total ?? 0;
  const requiresFilters = productsQuery.data?.requiresFilters ?? !filtersApplied;

  const allIds = useMemo(() => productAds.map((p) => p.adId), [productAds]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(action: "enable" | "pause" | "archive") {
    const adIds = [...selected];
    if (!adIds.length) return;
    bulkMutation.mutate({ adIds, action });
  }

  const adsConnected = statusQuery.data?.canGatherData === true || demoMode;

  function loadDemoData() {
    enableAdsConsoleDemoInUrl();
    setDemoMode(true);
    const states = buildStateFilter(draftFilters);
    setActiveFilters({
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      state: states,
    });
    setFiltersApplied(true);
    setPage(1);
    void statusQuery.refetch();
    toast({ title: "Demo data loaded", description: "Showing sample ad products for UI preview." });
  }

  function applyFilters() {
    if (!adsConnected && !demoMode) {
      toast({
        title: "Connect Amazon Ads first",
        description: "Save SP-API credentials and select an Ads profile on Marketplaces.",
        variant: "destructive",
      });
      return;
    }
    const states = buildStateFilter(draftFilters);
    if (!states) {
      toast({ title: "Select at least one status", variant: "destructive" });
      return;
    }
    setActiveFilters({
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      name: draftFilters.name.trim() || undefined,
      state: states,
    });
    setFiltersApplied(true);
    setPage(1);
    setFilterOpen(false);
  }

  function openFilterDialog() {
    if (activeFilters) {
      setDraftFilters({
        dateFrom: activeFilters.dateFrom ?? defaultRange.dateFrom,
        dateTo: activeFilters.dateTo ?? defaultRange.dateTo,
        name: activeFilters.name ?? "",
        enabled: activeFilters.state?.includes("ENABLED") ?? true,
        paused: activeFilters.state?.includes("PAUSED") ?? true,
        archived: activeFilters.state?.includes("ARCHIVED") ?? false,
      });
    }
    setFilterOpen(true);
  }

  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  return (
    <AdsConsoleLayout>
      {demoMode && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-sm text-teal-800">
            <span className="font-medium">Demo mode</span> — sample ad product rows for UI preview. Add{" "}
            <code className="rounded bg-teal-100 px-1">?demo=1</code> to the URL or use the button below.
          </p>
        </div>
      )}
      {!adsConnected && !demoMode && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-slate-700 flex-1 min-w-0">
              Connect Amazon Ads on Marketplaces and select a profile to load live ad product data.
            </p>
            <Button size="sm" variant="outline" className="shrink-0" asChild>
              <Link href="/marketplaces">Go to Marketplaces</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Ad Products</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage product ads in your Sponsored Products campaigns.
        </p>
      </div>

      <AdsConsoleToolbar
        title=""
        compare={compare}
        onCompareChange={setCompare}
        selectedCount={selected.size}
        bulkPending={bulkMutation.isPending}
        onBulkEnable={() => runBulk("enable")}
        onBulkPause={() => runBulk("pause")}
        onBulkArchive={() => runBulk("archive")}
        showBudgetBulk={false}
        createHref="/ads/new"
        createLabel="Add Product To SP Campaign"
        onFiltersClick={openFilterDialog}
        onAiClick={() =>
          toast({
            title: "AI assistant",
            description: "Use Create → AI campaign wizard for keyword research and launch.",
          })
        }
      />

      {productsQuery.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {productsQuery.error instanceof Error ? productsQuery.error.message : "Failed to load ad products"}
        </div>
      )}

      {productsQuery.isLoading && filtersApplied ? (
        <AdsConsoleTableShell loading empty={false}>
          <div />
        </AdsConsoleTableShell>
      ) : !filtersApplied || requiresFilters ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="py-16 px-6 text-center">
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Too much data to display at once. Please apply filters to view specific campaign data.
            </p>
            <Button
              variant="link"
              className="mt-3 text-orange-600 gap-1.5"
              onClick={openFilterDialog}
            >
              <Filter className="w-4 h-4" />
              Filter Campaigns
            </Button>
            {!demoMode && (
              <div className="mt-4">
                <Button variant="outline" className="border-teal-500 text-teal-700 hover:bg-teal-50" onClick={loadDemoData}>
                  Load demo data
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : productAds.length === 0 ? (
        <AdsConsoleTableShell empty emptyMessage="No ad products match your filters.">
          <div />
        </AdsConsoleTableShell>
      ) : (
        <>
          <AdsConsoleTableShell empty={false}>
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="w-10 sticky left-0 z-10 bg-slate-50/95">
                    <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} aria-label="Select all" />
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="min-w-[10rem]">Ads Product / Ad Name</TableHead>
                  <TableHead className="min-w-[8rem]">SKU</TableHead>
                  <TableHead className="min-w-[14rem]">Product Name</TableHead>
                  <TableHead className="min-w-[12rem]">Campaign Name</TableHead>
                  <TableHead className="whitespace-nowrap">Sponsored Type</TableHead>
                  <TableHead className="min-w-[9rem]">Ad Group</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productAds.map((row) => (
                  <TableRow key={row.adId} className="hover:bg-slate-50/50">
                    <TableCell className="sticky left-0 z-10 bg-white">
                      <Checkbox
                        checked={selected.has(row.adId)}
                        onCheckedChange={() => toggleOne(row.adId)}
                        aria-label={`Select ${row.adName ?? row.adId}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span className={adsStateBadge(row.state)}>{row.state.toLowerCase()}</span>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {row.adName ?? row.asin ?? row.sku ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">{row.sku ?? "—"}</TableCell>
                    <TableCell className="text-slate-700">{row.productName ?? "—"}</TableCell>
                    <TableCell className="text-slate-700">{row.campaignName ?? "—"}</TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">{row.sponsoredType}</TableCell>
                    <TableCell className="text-slate-600">{row.adGroupName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdsConsoleTableShell>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Showing {pageStart}–{pageEnd} of {total}
            </span>
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canPrev} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Campaigns</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">From</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={draftFilters.dateFrom}
                  onChange={(e) => setDraftFilters((d) => ({ ...d, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">To</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={draftFilters.dateTo}
                  onChange={(e) => setDraftFilters((d) => ({ ...d, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Search (ASIN, SKU, product, campaign)</Label>
              <Input
                className="mt-1"
                placeholder="Filter by name…"
                value={draftFilters.name}
                onChange={(e) => setDraftFilters((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draftFilters.enabled}
                  onCheckedChange={(v) => setDraftFilters((d) => ({ ...d, enabled: v === true }))}
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draftFilters.paused}
                  onCheckedChange={(v) => setDraftFilters((d) => ({ ...d, paused: v === true }))}
                />
                Paused
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draftFilters.archived}
                  onCheckedChange={(v) => setDraftFilters((d) => ({ ...d, archived: v === true }))}
                />
                Archived
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFilterOpen(false)}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={applyFilters}>
              Apply filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdsConsoleLayout>
  );
}
