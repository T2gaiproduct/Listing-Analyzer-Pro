import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  HelpCircle,
  ListFilter,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdsConsoleLayout } from "@/components/ads-console-layout";
import {
  AdsConsoleTableShell,
  AdsConsoleToolbar,
  adsStateBadge,
} from "@/components/ads-console-toolbar";
import { fetchAdsStatus } from "@/lib/ads-api";
import {
  defaultCampaignDateRange,
  fetchAdsConsoleTargets,
  type AdsConsoleTarget,
  type AdsConsoleTargetsQuery,
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
import { cn } from "@/lib/utils";

type TargetTypeChip = "all" | "keyword" | "product" | "other";

const COL = "whitespace-nowrap min-w-[7rem]";

function formatMoney(n?: number) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(n?: number) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function formatRatio(n?: number) {
  if (n == null) return "—";
  return n.toFixed(2);
}

function formatRpc(adSales?: number, clicks?: number) {
  if (adSales == null || clicks == null || clicks === 0) return "—";
  return formatMoney(adSales / clicks);
}

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

export default function AdsTargetsConsolePage() {
  const { toast } = useToast();
  const [demoMode, setDemoMode] = useState(() => isAdsConsoleDemoMode());
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetType, setTargetType] = useState<TargetTypeChip>("all");
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
  const [activeFilters, setActiveFilters] = useState<AdsConsoleTargetsQuery | null>(null);

  const statusQuery = useQuery({
    queryKey: ["ads-status", demoMode],
    queryFn: () => fetchAdsStatus(demoMode),
  });

  useEffect(() => {
    if (!demoMode || filtersApplied) return;
    const states = buildStateFilter(draftFilters);
    setActiveFilters({
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      state: states,
    });
    setFiltersApplied(true);
  }, [demoMode]);

  const queryParams: AdsConsoleTargetsQuery | null = activeFilters
    ? { ...activeFilters, targetType, page, pageSize, sort: "-spend", demo: demoMode }
    : null;

  const targetsQuery = useQuery({
    queryKey: ["ads-console-targets", demoMode, queryParams],
    queryFn: () => fetchAdsConsoleTargets(queryParams!),
    enabled: (statusQuery.data?.canGatherData === true || demoMode) && filtersApplied && queryParams != null,
    retry: false,
  });

  const targets = targetsQuery.data?.targets ?? [];
  const total = targetsQuery.data?.total ?? 0;
  const requiresFilters = targetsQuery.data?.requiresFilters ?? !filtersApplied;

  const allIds = useMemo(() => targets.map((t) => t.targetId), [targets]);
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
    toast({ title: "Demo data loaded", description: "Showing sample targets for UI preview." });
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

  const tabLabel =
    targetType === "all"
      ? "All Targets"
      : targetType === "keyword"
        ? "Keyword Targets"
        : targetType === "product"
          ? "Product Targets"
          : "Other Targets";

  return (
    <AdsConsoleLayout>
      {demoMode && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-sm text-teal-800">
            <span className="font-medium">Demo mode</span> — sample target rows for UI preview. Add{" "}
            <code className="rounded bg-teal-100 px-1">?demo=1</code> to the URL or use the button below.
          </p>
        </div>
      )}
      {!adsConnected && !demoMode && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-slate-700 flex-1 min-w-0">
              Connect Amazon Ads on Marketplaces and select a profile to load live target data.
            </p>
            <Button size="sm" variant="outline" className="shrink-0" asChild>
              <Link href="/marketplaces">Go to Marketplaces</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bulk Actions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage &amp; bulk edit your campaigns, targets, etc from one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500" aria-label="Help">
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-orange-500 text-orange-600" asChild>
            <Link href="/ads/campaigns">
              <ListFilter className="w-4 h-4" />
              Campaigns
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            { id: "all" as const, label: "All" },
            { id: "keyword" as const, label: "Keyword Targets" },
            { id: "product" as const, label: "Product Targets" },
            { id: "other" as const, label: "Other Targets" },
          ]
        ).map((chip) => {
          const active = targetType === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setTargetType(chip.id);
                setPage(1);
                setSelected(new Set());
              }}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium border transition-colors",
                active && "bg-orange-50 border-orange-400 text-orange-700",
                !active && "border-orange-300 text-orange-600 hover:bg-orange-50/50",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800">{tabLabel}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-slate-600"
            onClick={openFilterDialog}
          >
            <Filter className="w-3.5 h-3.5" />
            Saved Filters
          </Button>
        </div>
      </div>

      <AdsConsoleToolbar
        title=""
        compare={compare}
        onCompareChange={setCompare}
        selectedCount={selected.size}
        showBulk={false}
        createHref="/ads/new"
        createLabel="Create"
        onAiClick={() =>
          toast({
            title: "AI assistant",
            description: "Use Create → AI campaign wizard for keyword research and launch.",
          })
        }
      />

      {targetsQuery.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {targetsQuery.error instanceof Error ? targetsQuery.error.message : "Failed to load targets"}
        </div>
      )}

      {targetsQuery.isLoading && filtersApplied ? (
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
      ) : targets.length === 0 ? (
        <AdsConsoleTableShell empty emptyMessage="No targets match your filters.">
          <div />
        </AdsConsoleTableShell>
      ) : (
        <AdsConsoleTableShell empty={false}>
          <Table className="min-w-[2800px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-10 sticky left-0 z-10 bg-slate-50/95">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} aria-label="Select all" />
                </TableHead>
                <TableHead className={COL}>Status</TableHead>
                <TableHead className="min-w-[12rem]">Targets</TableHead>
                <TableHead className="min-w-[10rem]">Campaign Name</TableHead>
                <TableHead className={COL}>Sponsored Type</TableHead>
                <TableHead className={COL}>Match Type</TableHead>
                <TableHead className="min-w-[9rem]">Ad Group</TableHead>
                <TableHead className={COL}>Bid</TableHead>
                <TableHead className={COL}>Base Bid</TableHead>
                <TableHead className={COL}>Previous Bid</TableHead>
                <TableHead className="min-w-[8rem]">Last Bid Change</TableHead>
                <TableHead className={COL}>Ad Purchases</TableHead>
                <TableHead className={COL}>Clicks</TableHead>
                <TableHead className={COL}>Impressions</TableHead>
                <TableHead className="min-w-[9rem]">Top of Search Imp.</TableHead>
                <TableHead className={COL}>CTR</TableHead>
                <TableHead className={COL}>Ad Spend</TableHead>
                <TableHead className={COL}>CPC</TableHead>
                <TableHead className={COL}>CVR</TableHead>
                <TableHead className={COL}>Ad Sales</TableHead>
                <TableHead className={COL}>ROAS</TableHead>
                <TableHead className={COL}>ACOS</TableHead>
                <TableHead className={COL}>RPC</TableHead>
                <TableHead className={COL}>Old Tags</TableHead>
                {compare && <TableHead className={COL}>Target Kind</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((row: AdsConsoleTarget) => (
                <TableRow key={row.targetId} className="hover:bg-slate-50/50">
                  <TableCell className="sticky left-0 z-10 bg-white">
                    <Checkbox
                      checked={selected.has(row.targetId)}
                      onCheckedChange={() => toggleOne(row.targetId)}
                      aria-label={`Select ${row.targetText}`}
                    />
                  </TableCell>
                  <TableCell>
                    <span className={adsStateBadge(row.state)}>{row.state}</span>
                  </TableCell>
                  <TableCell className="font-medium text-slate-800 max-w-[14rem] truncate" title={row.targetText}>
                    {row.targetText}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate" title={row.campaignName}>
                    {row.campaignName ?? "—"}
                  </TableCell>
                  <TableCell>{row.sponsoredType}</TableCell>
                  <TableCell>{row.matchType ?? "—"}</TableCell>
                  <TableCell className="max-w-[10rem] truncate" title={row.adGroupName}>
                    {row.adGroupName ?? "—"}
                  </TableCell>
                  <TableCell>{formatMoney(row.bid)}</TableCell>
                  <TableCell>{formatMoney(row.baseBid)}</TableCell>
                  <TableCell>{formatMoney(row.previousBid)}</TableCell>
                  <TableCell>{row.lastBidChange ?? "—"}</TableCell>
                  <TableCell>{row.purchases ?? "—"}</TableCell>
                  <TableCell>{row.clicks ?? "—"}</TableCell>
                  <TableCell>{row.impressions ?? "—"}</TableCell>
                  <TableCell>{row.topOfSearchImpressions ?? "—"}</TableCell>
                  <TableCell>{formatPct(row.ctr)}</TableCell>
                  <TableCell className="font-medium">{formatMoney(row.spend)}</TableCell>
                  <TableCell>{formatMoney(row.cpc)}</TableCell>
                  <TableCell>{formatPct(row.cvr)}</TableCell>
                  <TableCell>{formatMoney(row.adSales)}</TableCell>
                  <TableCell>{formatRatio(row.roas)}</TableCell>
                  <TableCell>{formatPct(row.acos)}</TableCell>
                  <TableCell>{formatRpc(row.adSales, row.clicks)}</TableCell>
                  <TableCell>{row.oldTags ?? "—"}</TableCell>
                  {compare && <TableCell className="capitalize">{row.targetKind}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdsConsoleTableShell>
      )}

      {filtersApplied && !requiresFilters && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 px-1 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Label className="text-slate-500 font-normal">Rows per page</Label>
            <select
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span>{pageStart}–{pageEnd} of {total}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canPrev} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter targets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">From</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={draftFilters.dateFrom}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">To</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={draftFilters.dateTo}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Target or campaign name contains</Label>
              <Input
                className="mt-1"
                placeholder="Optional"
                value={draftFilters.name}
                onChange={(e) => setDraftFilters((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draftFilters.enabled} onCheckedChange={(c) => setDraftFilters((f) => ({ ...f, enabled: c === true }))} />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draftFilters.paused} onCheckedChange={(c) => setDraftFilters((f) => ({ ...f, paused: c === true }))} />
                Paused
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draftFilters.archived} onCheckedChange={(c) => setDraftFilters((f) => ({ ...f, archived: c === true }))} />
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
