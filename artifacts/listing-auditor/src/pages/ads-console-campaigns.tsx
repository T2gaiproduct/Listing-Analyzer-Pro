import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  bulkUpdateAdsCampaigns,
  defaultCampaignDateRange,
  fetchAdsConsoleCampaigns,
  type AdsConsoleCampaign,
  type AdsConsoleCampaignsQuery,
} from "@/lib/ads-console-api";
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

type CampaignTypeChip = "all" | "product" | "brand" | "display";

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

export default function AdsCampaignsConsolePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [campaignType, setCampaignType] = useState<CampaignTypeChip>("all");
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

  function buildStateFilter(d: typeof draftFilters): string {
    const states: string[] = [];
    if (d.enabled) states.push("ENABLED");
    if (d.paused) states.push("PAUSED");
    if (d.archived) states.push("ARCHIVED");
    return states.join(",");
  }

  const adsConnected = statusQuery.data?.canGatherData === true;

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
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-orange-500 text-orange-600">
            <ListFilter className="w-4 h-4" />
            Campaigns
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            { id: "all" as const, label: "All" },
            { id: "product" as const, label: "Product" },
            { id: "brand" as const, label: "Brand" },
            { id: "display" as const, label: "Display" },
          ]
        ).map((chip) => {
          const disabled = chip.id === "brand" || chip.id === "display";
          const active = campaignType === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && setCampaignType(chip.id)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium border transition-colors",
                disabled && "opacity-40 cursor-not-allowed border-slate-200 text-slate-400",
                !disabled && active && "bg-orange-50 border-orange-400 text-orange-700",
                !disabled && !active && "border-orange-300 text-orange-600 hover:bg-orange-50/50",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800">All Campaigns</span>
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
        bulkPending={bulkMutation.isPending}
        onBulkEnable={() => runBulk("enable")}
        onBulkPause={() => runBulk("pause")}
        onBulkArchive={() => runBulk("archive")}
        onBulkBudget={(budget) => runBulk("budget", budget)}
        onAiClick={() => toast({ title: "AI assistant", description: "Use Create → AI campaign wizard for keyword research and launch." })}
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
          </div>
        </div>
      ) : campaigns.length === 0 ? (
        <AdsConsoleTableShell empty emptyMessage="No campaigns match your filters.">
          <div />
        </AdsConsoleTableShell>
      ) : (
        <AdsConsoleTableShell empty={false}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} aria-label="Select all" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Today&apos;s consumption</TableHead>
                <TableHead>Targeting Type</TableHead>
                <TableHead>Sponsored Type</TableHead>
                <TableHead>Portfolio Name</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Base Budget</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Clicks</TableHead>
                <TableHead>Impressions</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>CPC</TableHead>
                <TableHead>Ad Spend</TableHead>
                <TableHead>CVR</TableHead>
                <TableHead>Ad Sales</TableHead>
                <TableHead>ROAS</TableHead>
                <TableHead>ACOS</TableHead>
                {compare && <TableHead>Bidding Strategy</TableHead>}
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
                  <TableCell>
                    <span className={adsStateBadge(row.state)}>{row.state}</span>
                  </TableCell>
                  <TableCell className="font-medium text-slate-800 max-w-[14rem] truncate">{row.name}</TableCell>
                  <TableCell>{formatMoney(row.todaySpend)}</TableCell>
                  <TableCell>{row.targetingType}</TableCell>
                  <TableCell>{row.sponsoredType}</TableCell>
                  <TableCell>{row.portfolioName ?? "—"}</TableCell>
                  <TableCell>{formatMoney(row.budget)}</TableCell>
                  <TableCell>{formatMoney(row.baseBudget)}</TableCell>
                  <TableCell>{row.startDate ?? "—"}</TableCell>
                  <TableCell>{row.clicks ?? "—"}</TableCell>
                  <TableCell>{row.impressions ?? "—"}</TableCell>
                  <TableCell>{formatPct(row.ctr)}</TableCell>
                  <TableCell>{formatMoney(row.cpc)}</TableCell>
                  <TableCell className="font-medium">{formatMoney(row.spend)}</TableCell>
                  <TableCell>{formatPct(row.cvr)}</TableCell>
                  <TableCell>{formatMoney(row.adSales)}</TableCell>
                  <TableCell>{formatRatio(row.roas)}</TableCell>
                  <TableCell>{formatPct(row.acos)}</TableCell>
                  {compare && <TableCell>{row.biddingStrategy ?? "—"}</TableCell>}
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
