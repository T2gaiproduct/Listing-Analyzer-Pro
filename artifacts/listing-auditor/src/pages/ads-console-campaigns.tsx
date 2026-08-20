import { useEffect, useMemo, useRef, useState } from "react";
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
import { fetchAdsStatus } from "@/lib/ads-api";
import {
  bulkUpdateAdsCampaigns,
  defaultCampaignDateRange,
  fetchAdsConsoleCampaigns,
  type AdsConsoleCampaign,
  type AdsConsoleCampaignsQuery,
} from "@/lib/ads-console-api";
import { useAdsConsoleColumns } from "@/lib/ads-console-columns";
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

const CAMPAIGN_COLUMN_DEFS = [
  { id: "status", label: "Status", required: true },
  { id: "campaign", label: "Campaign", required: true },
  { id: "todaySpend", label: "Today's consumption" },
  { id: "targetingType", label: "Targeting Type" },
  { id: "sponsoredType", label: "Sponsored Type" },
  { id: "portfolioName", label: "Portfolio Name" },
  { id: "budget", label: "Budget" },
  { id: "baseBudget", label: "Base Budget" },
  { id: "startDate", label: "Start Date" },
  { id: "clicks", label: "Clicks" },
  { id: "impressions", label: "Impressions" },
  { id: "ctr", label: "CTR" },
  { id: "cpc", label: "CPC" },
  { id: "spend", label: "Ad Spend" },
  { id: "cvr", label: "CVR" },
  { id: "adSales", label: "Ad Sales" },
  { id: "roas", label: "ROAS" },
  { id: "acos", label: "ACOS" },
  { id: "biddingStrategy", label: "Bidding Strategy", defaultVisible: false },
];

function campaignExportRow(row: AdsConsoleCampaign): Record<string, string> {
  return {
    status: row.state,
    campaign: row.name,
    todaySpend: formatMoney(row.todaySpend),
    targetingType: row.targetingType ?? "—",
    sponsoredType: row.sponsoredType ?? "—",
    portfolioName: row.portfolioName ?? "—",
    budget: formatMoney(row.budget),
    baseBudget: formatMoney(row.baseBudget),
    startDate: row.startDate ?? "—",
    clicks: row.clicks != null ? String(row.clicks) : "—",
    impressions: row.impressions != null ? String(row.impressions) : "—",
    ctr: formatPct(row.ctr),
    cpc: formatMoney(row.cpc),
    spend: formatMoney(row.spend),
    cvr: formatPct(row.cvr),
    adSales: formatMoney(row.adSales),
    roas: formatRatio(row.roas),
    acos: formatPct(row.acos),
    biddingStrategy: row.biddingStrategy ?? "—",
  };
}

export default function AdsCampaignsConsolePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [compactView, setCompactView] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLDivElement>(null);
  const { columnOptions, toggleColumn, isVisible } = useAdsConsoleColumns(CAMPAIGN_COLUMN_DEFS);
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
  const [activeFilters, setActiveFilters] = useState<AdsConsoleCampaignsQuery | null>(null);

  const statusQuery = useQuery({ queryKey: ["ads-status"], queryFn: fetchAdsStatus });

  const adsConnected = statusQuery.data?.canGatherData === true;

  useEffect(() => {
    if (!adsConnected || filtersApplied) return;
    const states = buildStateFilter(draftFilters);
    if (!states) return;
    setActiveFilters({
      dateFrom: draftFilters.dateFrom,
      dateTo: draftFilters.dateTo,
      state: states,
    });
    setFiltersApplied(true);
  }, [adsConnected, filtersApplied]);

  const queryParams: AdsConsoleCampaignsQuery | null = activeFilters
    ? { ...activeFilters, page, pageSize, sort: "-spend" }
    : null;

  const campaignsQuery = useQuery({
    queryKey: ["ads-console-campaigns", queryParams],
    queryFn: () => fetchAdsConsoleCampaigns(queryParams!),
    enabled: statusQuery.data?.canGatherData === true && filtersApplied && queryParams != null,
    retry: false,
  });

  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const total = campaignsQuery.data?.total ?? 0;
  const requiresFilters = campaignsQuery.data?.requiresFilters ?? !filtersApplied;

  const bulkMutation = useMutation({
    mutationFn: bulkUpdateAdsCampaigns,
    onSuccess: (data) => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["ads-console-campaigns"] });
      toast({
        title: data.updated > 0 ? "Bulk action applied" : "No campaigns updated",
        description: data.errors.length ? data.errors.join("; ") : undefined,
        variant: data.errors.length && data.updated === 0 ? "destructive" : "default",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Bulk action failed", description: err.message, variant: "destructive" }),
  });

  const allIds = useMemo(() => campaigns.map((c) => c.campaignId), [campaigns]);
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

  function runBulk(action: "enable" | "pause" | "archive" | "budget", dailyBudget?: number) {
    const campaignIds = [...selected];
    if (!campaignIds.length) return;
    bulkMutation.mutate({
      campaignIds,
      action,
      dailyBudget: action === "budget" ? dailyBudget : undefined,
    });
  }

  function applyFilters() {
    if (!adsConnected) {
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

  const exportData = useMemo(() => {
    if (!campaigns.length) return null;
    const exportColumns = CAMPAIGN_COLUMN_DEFS.filter((col) => {
      const visible = columnOptions.find((c) => c.id === col.id)?.visible ?? true;
      return visible;
    });
    return {
      filename: "campaigns",
      headers: exportColumns.map((col) => col.label),
      rows: campaigns.map((row) =>
        exportColumns.map((col) => campaignExportRow(row)[col.id] ?? ""),
      ),
    };
  }, [campaigns, columnOptions]);

  return (
    <AdsConsoleLayout>
      {!adsConnected && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-slate-700 flex-1 min-w-0">
              Connect Amazon Ads on Marketplaces and select a profile to load live campaign data.
            </p>
            <Button size="sm" variant="outline" className="shrink-0" asChild>
              <Link href="/marketplaces">Go to Marketplaces</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Campaigns</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage and bulk edit Sponsored Products campaigns.
        </p>
      </div>

      <AdsConsoleToolbar
        title=""
        selectedCount={selected.size}
        bulkPending={bulkMutation.isPending}
        onBulkEnable={() => runBulk("enable")}
        onBulkPause={() => runBulk("pause")}
        onBulkArchive={() => runBulk("archive")}
        onBulkBudget={(budget) => runBulk("budget", budget)}
        onFiltersClick={openFilterDialog}
        exportData={exportData}
        onExportEmpty={() => toast({ title: "Nothing to export", description: "Load campaign data first." })}
        columnOptions={columnOptions}
        onColumnVisibilityChange={toggleColumn}
        compactView={compactView}
        onCompactViewChange={setCompactView}
        tableRef={tableRef}
      />

      {campaignsQuery.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {campaignsQuery.error instanceof Error ? campaignsQuery.error.message : "Failed to load campaigns"}
        </div>
      )}

      {campaignsQuery.isLoading && filtersApplied ? (
        <AdsConsoleTableShell loading empty={false}>
          <div />
        </AdsConsoleTableShell>
      ) : !filtersApplied || requiresFilters ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="py-16 px-6 text-center">
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Connect Amazon Ads and choose a date range to load campaign data.
            </p>
            <Button
              variant="link"
              className="mt-3 text-orange-600 gap-1.5"
              onClick={openFilterDialog}
            >
              <Filter className="w-4 h-4" />
              Filter campaigns
            </Button>
          </div>
        </div>
      ) : campaigns.length === 0 ? (
        <AdsConsoleTableShell empty emptyMessage="No campaigns match your filters.">
          <div />
        </AdsConsoleTableShell>
      ) : (
        <AdsConsoleTableShell empty={false} compact={compactView} shellRef={tableRef}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} aria-label="Select all" />
                </TableHead>
                {isVisible("status") && <TableHead>Status</TableHead>}
                {isVisible("campaign") && <TableHead>Campaign</TableHead>}
                {isVisible("todaySpend") && <TableHead>Today&apos;s consumption</TableHead>}
                {isVisible("targetingType") && <TableHead>Targeting Type</TableHead>}
                {isVisible("sponsoredType") && <TableHead>Sponsored Type</TableHead>}
                {isVisible("portfolioName") && <TableHead>Portfolio Name</TableHead>}
                {isVisible("budget") && <TableHead>Budget</TableHead>}
                {isVisible("baseBudget") && <TableHead>Base Budget</TableHead>}
                {isVisible("startDate") && <TableHead>Start Date</TableHead>}
                {isVisible("clicks") && <TableHead>Clicks</TableHead>}
                {isVisible("impressions") && <TableHead>Impressions</TableHead>}
                {isVisible("ctr") && <TableHead>CTR</TableHead>}
                {isVisible("cpc") && <TableHead>CPC</TableHead>}
                {isVisible("spend") && <TableHead>Ad Spend</TableHead>}
                {isVisible("cvr") && <TableHead>CVR</TableHead>}
                {isVisible("adSales") && <TableHead>Ad Sales</TableHead>}
                {isVisible("roas") && <TableHead>ROAS</TableHead>}
                {isVisible("acos") && <TableHead>ACOS</TableHead>}
                {isVisible("biddingStrategy") && <TableHead>Bidding Strategy</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((row: AdsConsoleCampaign) => (
                <TableRow key={row.campaignId} className="hover:bg-slate-50/50">
                  <TableCell>
                    <Checkbox
                      checked={selected.has(row.campaignId)}
                      onCheckedChange={() => toggleOne(row.campaignId)}
                      aria-label={`Select ${row.name}`}
                    />
                  </TableCell>
                  {isVisible("status") && (
                    <TableCell>
                      <span className={adsStateBadge(row.state)}>{row.state}</span>
                    </TableCell>
                  )}
                  {isVisible("campaign") && (
                    <TableCell className="font-medium text-slate-800 max-w-[14rem] truncate">{row.name}</TableCell>
                  )}
                  {isVisible("todaySpend") && <TableCell>{formatMoney(row.todaySpend)}</TableCell>}
                  {isVisible("targetingType") && <TableCell>{row.targetingType}</TableCell>}
                  {isVisible("sponsoredType") && <TableCell>{row.sponsoredType}</TableCell>}
                  {isVisible("portfolioName") && <TableCell>{row.portfolioName ?? "—"}</TableCell>}
                  {isVisible("budget") && <TableCell>{formatMoney(row.budget)}</TableCell>}
                  {isVisible("baseBudget") && <TableCell>{formatMoney(row.baseBudget)}</TableCell>}
                  {isVisible("startDate") && <TableCell>{row.startDate ?? "—"}</TableCell>}
                  {isVisible("clicks") && <TableCell>{row.clicks ?? "—"}</TableCell>}
                  {isVisible("impressions") && <TableCell>{row.impressions ?? "—"}</TableCell>}
                  {isVisible("ctr") && <TableCell>{formatPct(row.ctr)}</TableCell>}
                  {isVisible("cpc") && <TableCell>{formatMoney(row.cpc)}</TableCell>}
                  {isVisible("spend") && <TableCell className="font-medium">{formatMoney(row.spend)}</TableCell>}
                  {isVisible("cvr") && <TableCell>{formatPct(row.cvr)}</TableCell>}
                  {isVisible("adSales") && <TableCell>{formatMoney(row.adSales)}</TableCell>}
                  {isVisible("roas") && <TableCell>{formatRatio(row.roas)}</TableCell>}
                  {isVisible("acos") && <TableCell>{formatPct(row.acos)}</TableCell>}
                  {isVisible("biddingStrategy") && (
                    <TableCell>{row.biddingStrategy ?? "—"}</TableCell>
                  )}
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
            <DialogTitle>Filter campaigns</DialogTitle>
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
              <Label className="text-xs text-slate-500">Campaign name contains</Label>
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
