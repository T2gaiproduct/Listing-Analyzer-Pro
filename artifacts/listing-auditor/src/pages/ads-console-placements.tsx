import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "@/components/ads-console-toolbar";
import { fetchAdsStatusForDemo } from "@/lib/ads-api";
import {
  defaultCampaignDateRange,
  fetchAdsConsolePlacements,
  type AdsConsolePlacementsQuery,
} from "@/lib/ads-console-api";
import { enableAdsConsoleDemoInUrl, isAdsConsoleDemoMode } from "@/lib/ads-console-demo";
import { buildAdsConsoleCsvExport } from "@/lib/ads-console-csv";
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
import { cn } from "@/lib/utils";

type PlacementTypeChip = "all" | "amazon_business";

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

function formatBiddingStrategy(strategy?: string): string {
  switch (strategy?.toUpperCase()) {
    case "LEGACY_FOR_SALES":
      return "Dynamic bids — down only";
    case "AUTO_FOR_SALES":
      return "Dynamic bids — up and down";
    case "MANUAL":
      return "Fixed bids";
    default:
      return strategy ?? "—";
  }
}

function formatPct(n?: number): string {
  if (n == null) return "—";
  return `${n}%`;
}

function formatNum(n?: number): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export default function AdsPlacementsConsolePage() {
  const { toast } = useToast();
  const [demoMode, setDemoMode] = useState(() => isAdsConsoleDemoMode());
  const [compare, setCompare] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [placementType, setPlacementType] = useState<PlacementTypeChip>("all");
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
  const [activeFilters, setActiveFilters] = useState<AdsConsolePlacementsQuery | null>(null);

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

  const queryParams: AdsConsolePlacementsQuery | null = activeFilters
    ? { ...activeFilters, placementType, page, pageSize, sort: "campaignName", demo: demoMode }
    : null;

  const placementsQuery = useQuery({
    queryKey: ["ads-console-placements", demoMode, queryParams],
    queryFn: () => fetchAdsConsolePlacements(queryParams!),
    enabled: (statusQuery.data?.canGatherData === true || demoMode) && filtersApplied && queryParams != null,
    retry: false,
  });

  const placements = placementsQuery.data?.placements ?? [];
  const total = placementsQuery.data?.total ?? 0;
  const requiresFilters = placementsQuery.data?.requiresFilters ?? !filtersApplied;

  const allIds = useMemo(() => placements.map((p) => p.placementId), [placements]);
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
    toast({ title: "Demo data loaded", description: "Showing sample placement rows for UI preview." });
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

  function bulkComingSoon() {
    toast({
      title: "Bulk bid adjustment",
      description: "Placement bid adjustment bulk updates will be available in a future release.",
    });
  }

  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  const exportData = useMemo(
    () =>
      buildAdsConsoleCsvExport(
        "placements",
        ["Campaign", "Placement", "Bid %", "Status", "Sponsored Type"],
        placements.map((row) => ({
          campaign: row.campaignName,
          placement: row.placementLabel ?? row.placement,
          percentage: row.percentage != null ? String(row.percentage) : "",
          status: row.state,
          sponsoredType: row.sponsoredType ?? "",
        })),
        ["campaign", "placement", "percentage", "status", "sponsoredType"],
      ),
    [placements],
  );

  return (
    <AdsConsoleLayout>
      {demoMode && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-sm text-teal-800">
            <span className="font-medium">Demo mode</span> — sample placement rows for UI preview. Add{" "}
            <code className="rounded bg-teal-100 px-1">?demo=1</code> to the URL or use the button below.
          </p>
        </div>
      )}
      {!adsConnected && !demoMode && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-slate-700 flex-1 min-w-0">
              Connect Amazon Ads on Marketplaces and select a profile to load live placement data.
            </p>
            <Button size="sm" variant="outline" className="shrink-0" asChild>
              <Link href="/marketplaces">Go to Marketplaces</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Placements</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          View placement bid adjustments across campaigns.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            { id: "all" as const, label: "All Placements" },
            { id: "amazon_business" as const, label: "Amazon Business Placements" },
          ]
        ).map((chip) => {
          const active = placementType === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setPlacementType(chip.id);
                setPage(1);
                setSelected(new Set());
              }}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium border transition-colors",
                active && "bg-emerald-50 border-emerald-500 text-emerald-800",
                !active && "border-slate-300 text-slate-600 hover:bg-slate-50",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <AdsConsoleToolbar
        title=""
        compare={compare}
        onCompareChange={setCompare}
        selectedCount={selected.size}
        showCreate={false}
        hideActivityLog
        onFiltersClick={openFilterDialog}
        exportData={exportData}
        onExportEmpty={() => toast({ title: "Nothing to export", description: "Load placement data first." })}
        compactView={compactView}
        onCompactViewChange={setCompactView}
        tableRef={tableRef}
        onBulkEnable={bulkComingSoon}
        onBulkPause={bulkComingSoon}
        onBulkArchive={bulkComingSoon}
      />

      {placementsQuery.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {placementsQuery.error instanceof Error ? placementsQuery.error.message : "Failed to load placements"}
        </div>
      )}

      {placementsQuery.isLoading && filtersApplied ? (
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
      ) : placements.length === 0 ? (
        <AdsConsoleTableShell empty emptyMessage="No placements match your filters.">
          <div />
        </AdsConsoleTableShell>
      ) : (
        <>
          <AdsConsoleTableShell empty={false} compact={compactView} shellRef={tableRef}>
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="w-10 sticky left-0 z-10 bg-slate-50/95">
                    <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} aria-label="Select all" />
                  </TableHead>
                  <TableHead className="min-w-[12rem]">Campaign Name</TableHead>
                  <TableHead className="min-w-[11rem]">Placements</TableHead>
                  <TableHead className="min-w-[12rem]">Campaign bidding strategy</TableHead>
                  <TableHead className="whitespace-nowrap">Bid Adjustment</TableHead>
                  <TableHead className="whitespace-nowrap">Base Bid Adjustm...</TableHead>
                  <TableHead className="whitespace-nowrap">Sponsored Type</TableHead>
                  <TableHead className="whitespace-nowrap">Ad Purchases</TableHead>
                  <TableHead className="whitespace-nowrap">Impressions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {placements.map((row) => (
                  <TableRow key={row.placementId} className="hover:bg-slate-50/50">
                    <TableCell className="sticky left-0 z-10 bg-white">
                      <Checkbox
                        checked={selected.has(row.placementId)}
                        onCheckedChange={() => toggleOne(row.placementId)}
                        aria-label={`Select ${row.campaignName}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">{row.campaignName}</TableCell>
                    <TableCell className="text-slate-700">{row.placementLabel ?? row.placement}</TableCell>
                    <TableCell className="text-slate-600">{formatBiddingStrategy(row.biddingStrategy)}</TableCell>
                    <TableCell className="text-slate-700">{formatPct(row.percentage)}</TableCell>
                    <TableCell className="text-slate-700">{formatPct(row.baseBidAdjustment)}</TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">{row.sponsoredType}</TableCell>
                    <TableCell className="text-slate-700">{formatNum(row.purchases)}</TableCell>
                    <TableCell className="text-slate-700">{formatNum(row.impressions)}</TableCell>
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
              <Label className="text-xs text-slate-500">Search (campaign or placement)</Label>
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
