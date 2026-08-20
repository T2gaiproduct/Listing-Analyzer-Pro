import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { AdsConsoleTableShell, AdsConsoleToolbar } from "@/components/ads-console-toolbar";
import { fetchAdsStatusForDemo } from "@/lib/ads-api";
import {
  defaultCampaignDateRange,
  fetchAdsConsoleSearchTerms,
  type AdsConsoleSearchTerm,
  type AdsConsoleSearchTermsQuery,
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

type TermTypeChip = "all" | "auto" | "auto_product" | "manual";

const COL = "whitespace-nowrap min-w-[7rem]";

function formatMoney(n?: number) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(n?: number) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

export default function AdsSearchTermsConsolePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [demoMode, setDemoMode] = useState(() => isAdsConsoleDemoMode());
  const [compare, setCompare] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [termType, setTermType] = useState<TermTypeChip>("all");
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const defaultRange = defaultCampaignDateRange();
  const [draftFilters, setDraftFilters] = useState({
    dateFrom: defaultRange.dateFrom,
    dateTo: defaultRange.dateTo,
    name: "",
  });
  const [activeFilters, setActiveFilters] = useState<AdsConsoleSearchTermsQuery | null>(null);

  const statusQuery = useQuery({
    queryKey: ["ads-status", demoMode],
    queryFn: () => fetchAdsStatusForDemo(demoMode),
  });

  useEffect(() => {
    if (filtersApplied) return;
    if (!demoMode && !statusQuery.data?.canGatherData) return;
    setActiveFilters({
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      demo: demoMode,
    });
    setFiltersApplied(true);
  }, [demoMode, statusQuery.data?.canGatherData, filtersApplied, draftFilters.dateFrom, draftFilters.dateTo]);

  const queryParams: AdsConsoleSearchTermsQuery | null = activeFilters
    ? { ...activeFilters, termType, page, pageSize, sort: "-spend", demo: demoMode }
    : null;

  const searchTermsQuery = useQuery({
    queryKey: ["ads-console-search-terms", demoMode, queryParams],
    queryFn: () => fetchAdsConsoleSearchTerms(queryParams!),
    enabled: (statusQuery.data?.canGatherData === true || demoMode) && filtersApplied && queryParams != null,
    retry: false,
  });

  const searchTerms = searchTermsQuery.data?.searchTerms ?? [];
  const total = searchTermsQuery.data?.total ?? 0;
  const requiresFilters = searchTermsQuery.data?.requiresFilters ?? !filtersApplied;

  const allIds = useMemo(
    () => searchTerms.map((t) => t.searchTermId || t.searchTerm),
    [searchTerms],
  );
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
    setActiveFilters({
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      demo: true,
    });
    setFiltersApplied(true);
    setPage(1);
    void statusQuery.refetch();
    void qc.invalidateQueries({ queryKey: ["ads-console-search-terms"] });
    toast({ title: "Demo data loaded", description: "Showing sample search terms for UI preview." });
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
    setActiveFilters({
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      name: draftFilters.name.trim() || undefined,
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
      });
    }
    setFilterOpen(true);
  }

  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  const exportData = useMemo(
    () =>
      buildAdsConsoleCsvExport(
        "search-terms",
        ["Search Term", "Campaign", "Ad Group", "Clicks", "Impressions", "Spend", "CTR"],
        searchTerms.map((row) => ({
          searchTerm: row.searchTerm,
          campaign: row.campaignName ?? "",
          adGroup: row.adGroupName ?? "",
          clicks: row.clicks ?? "",
          impressions: row.impressions ?? "",
          spend: row.spend != null ? String(row.spend) : "",
          ctr: row.ctr != null ? `${(row.ctr * 100).toFixed(2)}%` : "",
        })),
        ["searchTerm", "campaign", "adGroup", "clicks", "impressions", "spend", "ctr"],
      ),
    [searchTerms],
  );

  return (
    <AdsConsoleLayout>
      {demoMode && (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-sm text-teal-800">
            <span className="font-medium">Demo mode</span> — sample search term rows for UI preview.
          </p>
        </div>
      )}
      {!adsConnected && !demoMode && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-slate-700 flex-1 min-w-0">
              Connect Amazon Ads on Marketplaces and select a profile to load live search term data.
            </p>
            <Button size="sm" variant="outline" className="shrink-0" asChild>
              <Link href="/marketplaces">Go to Marketplaces</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Search Terms</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Review search term performance from your Sponsored Products campaigns.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            { id: "all" as const, label: "All" },
            { id: "auto" as const, label: "Auto Search Terms" },
            { id: "auto_product" as const, label: "Auto Search Products" },
            { id: "manual" as const, label: "Manual Search Terms" },
          ]
        ).map((chip) => {
          const active = termType === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setTermType(chip.id);
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

      <AdsConsoleToolbar
        title=""
        compare={compare}
        onCompareChange={setCompare}
        selectedCount={selected.size}
        showBulk={false}
        showCreate={false}
        hideActivityLog
        onFiltersClick={openFilterDialog}
        exportData={exportData}
        onExportEmpty={() => toast({ title: "Nothing to export", description: "Load search term data first." })}
        compactView={compactView}
        onCompactViewChange={setCompactView}
        tableRef={tableRef}
      />

      {searchTermsQuery.isError && !demoMode && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchTermsQuery.error instanceof Error ? searchTermsQuery.error.message : "Failed to load search terms"}
        </div>
      )}

      {searchTermsQuery.isLoading && filtersApplied ? (
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
      ) : searchTerms.length === 0 ? (
        <AdsConsoleTableShell empty emptyMessage="No search terms match your filters.">
          <div />
        </AdsConsoleTableShell>
      ) : (
        <AdsConsoleTableShell empty={false} compact={compactView} shellRef={tableRef}>
          <Table className="min-w-[1600px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-10 sticky left-0 z-10 bg-slate-50/95">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} aria-label="Select all" />
                </TableHead>
                <TableHead className="min-w-[12rem]">Search Term</TableHead>
                <TableHead className={COL}>Sponsored Type</TableHead>
                <TableHead className="min-w-[10rem]">Campaign Name</TableHead>
                <TableHead className="min-w-[9rem]">Ad group Name</TableHead>
                <TableHead className={COL}>Ad Purchases</TableHead>
                <TableHead className={COL}>Clicks</TableHead>
                <TableHead className={COL}>Impressions</TableHead>
                <TableHead className={COL}>CPC</TableHead>
                <TableHead className={COL}>CTR</TableHead>
                <TableHead className={COL}>Ad Spend</TableHead>
                {compare && <TableHead className={COL}>Term Type</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchTerms.map((row: AdsConsoleSearchTerm) => {
                const rowId = row.searchTermId || row.searchTerm;
                return (
                  <TableRow key={rowId} className="hover:bg-slate-50/50">
                    <TableCell className="sticky left-0 z-10 bg-white">
                      <Checkbox
                        checked={selected.has(rowId)}
                        onCheckedChange={() => toggleOne(rowId)}
                        aria-label={`Select ${row.searchTerm}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-800 max-w-[14rem] truncate" title={row.searchTerm}>
                      {row.searchTerm}
                    </TableCell>
                    <TableCell>{row.sponsoredType ?? "Sponsored Products"}</TableCell>
                    <TableCell className="max-w-[12rem] truncate" title={row.campaignName}>
                      {row.campaignName ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate" title={row.adGroupName}>
                      {row.adGroupName ?? "—"}
                    </TableCell>
                    <TableCell>{row.purchases ?? row.orders ?? "—"}</TableCell>
                    <TableCell>{row.clicks ?? "—"}</TableCell>
                    <TableCell>{row.impressions ?? "—"}</TableCell>
                    <TableCell>{formatMoney(row.cpc)}</TableCell>
                    <TableCell>{formatPct(row.ctr)}</TableCell>
                    <TableCell className="font-medium">
                      {formatMoney(row.spend ?? (row.costCents != null ? row.costCents / 100 : undefined))}
                    </TableCell>
                    {compare && (
                      <TableCell className="capitalize">
                        {row.termKind?.replace("_", " ") ?? "—"}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
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
            <DialogTitle>Filter search terms</DialogTitle>
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
              <Label className="text-xs text-slate-500">Search term or campaign name contains</Label>
              <Input
                className="mt-1"
                placeholder="Optional"
                value={draftFilters.name}
                onChange={(e) => setDraftFilters((f) => ({ ...f, name: e.target.value }))}
              />
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
