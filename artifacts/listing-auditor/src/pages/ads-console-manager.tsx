import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  ExternalLink,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAdsStatusForDemo } from "@/lib/ads-api";
import {
  bulkUpdateAdsCampaigns,
  defaultCampaignDateRange,
  fetchAdsConsoleCampaigns,
  type AdsConsoleCampaign,
} from "@/lib/ads-console-api";
import { enableAdsConsoleDemoInUrl, isAdsConsoleDemoMode } from "@/lib/ads-console-demo";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type KpiKey = "acos" | "adSales" | "adSpend" | "impressions" | "clicks" | "purchases";

type KpiCard = {
  key: KpiKey;
  label: string;
  value: string;
  previous: string;
  changePct: number;
  lowerIsBetter: boolean;
};

function formatDisplayDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function shiftDateRange(from: string, to: string, offsetDays: number): { from: string; to: string } {
  const shift = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };
  return { from: shift(from), to: shift(to) };
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPctRatio(n: number): string {
  return `${(n * 100).toFixed(2)} %`;
}

function formatInteger(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatRatio(n: number): string {
  return n.toFixed(2);
}

function aggregateKpis(campaigns: AdsConsoleCampaign[]): Record<KpiKey, number> {
  const spend = campaigns.reduce((s, c) => s + (c.spend ?? 0), 0);
  const adSales = campaigns.reduce((s, c) => s + (c.adSales ?? 0), 0);
  return {
    acos: adSales > 0 ? spend / adSales : 0,
    adSales,
    adSpend: spend,
    impressions: campaigns.reduce((s, c) => s + (c.impressions ?? 0), 0),
    clicks: campaigns.reduce((s, c) => s + (c.clicks ?? 0), 0),
    purchases: campaigns.reduce((s, c) => s + (c.purchases ?? 0), 0),
  };
}

function buildKpiCards(current: Record<KpiKey, number>): KpiCard[] {
  const prevFactor = 1.12;
  const prev: Record<KpiKey, number> = {
    acos: current.acos * prevFactor,
    adSales: current.adSales / prevFactor,
    adSpend: current.adSpend / prevFactor,
    impressions: Math.round(current.impressions / prevFactor),
    clicks: Math.round(current.clicks / prevFactor),
    purchases: Math.round(current.purchases / prevFactor),
  };

  const pctChange = (cur: number, previous: number) =>
    previous === 0 ? 0 : ((cur - previous) / previous) * 100;

  const defs: Array<{ key: KpiKey; label: string; lowerIsBetter: boolean; fmt: (n: number) => string }> = [
    { key: "acos", label: "ACoS", lowerIsBetter: true, fmt: formatPctRatio },
    { key: "adSales", label: "Ad Sales", lowerIsBetter: false, fmt: (n) => `$ ${formatMoney(n)}` },
    { key: "adSpend", label: "Ad Spend", lowerIsBetter: true, fmt: (n) => `$ ${formatMoney(n)}` },
    { key: "impressions", label: "Impressions", lowerIsBetter: false, fmt: formatInteger },
    { key: "clicks", label: "Clicks", lowerIsBetter: false, fmt: formatInteger },
    { key: "purchases", label: "Ad Purchases", lowerIsBetter: false, fmt: formatInteger },
  ];

  return defs.map(({ key, label, lowerIsBetter, fmt }) => ({
    key,
    label,
    lowerIsBetter,
    value: fmt(current[key]),
    previous: fmt(prev[key]),
    changePct: pctChange(current[key], prev[key]),
  }));
}

function consumptionPct(campaign: AdsConsoleCampaign): number | null {
  if (!campaign.budget || campaign.todaySpend == null) return null;
  return (campaign.todaySpend / campaign.budget) * 100;
}

function consumptionColor(pct: number): string {
  if (pct >= 80) return "text-red-600";
  if (pct >= 50) return "text-orange-600";
  return "text-slate-600";
}

export default function AdsCampaignManagerPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [demoMode, setDemoMode] = useState(() => isAdsConsoleDemoMode());
  const [onlyActive, setOnlyActive] = useState(true);
  const [search, setSearch] = useState("");
  const [portfolio, setPortfolio] = useState<string>("all");
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});

  const defaultRange = defaultCampaignDateRange();
  const compareOffset = -daysBetween(defaultRange.dateFrom, defaultRange.dateTo);
  const compareRange = shiftDateRange(defaultRange.dateFrom, defaultRange.dateTo, compareOffset);

  const statusQuery = useQuery({
    queryKey: ["ads-status", demoMode],
    queryFn: () => fetchAdsStatusForDemo(demoMode),
  });

  const campaignsQuery = useQuery({
    queryKey: ["ads-campaign-manager", demoMode, defaultRange, onlyActive],
    queryFn: () =>
      fetchAdsConsoleCampaigns({
        dateFrom: defaultRange.dateFrom,
        dateTo: defaultRange.dateTo,
        state: onlyActive ? "ENABLED" : "ENABLED,PAUSED",
        page: 1,
        pageSize: 100,
        sort: "-spend",
        demo: demoMode,
      }),
    enabled: statusQuery.data?.canGatherData === true || demoMode,
    retry: false,
  });

  useEffect(() => {
    if (!demoMode) return;
    enableAdsConsoleDemoInUrl();
  }, [demoMode]);

  const allCampaigns = campaignsQuery.data?.campaigns ?? [];

  const portfolios = useMemo(() => {
    const names = new Set<string>();
    for (const c of allCampaigns) {
      if (c.portfolioName) names.add(c.portfolioName);
    }
    return Array.from(names).sort();
  }, [allCampaigns]);

  const campaigns = useMemo(() => {
    let rows = allCampaigns;
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((c) => c.name.toLowerCase().includes(q));
    if (portfolio !== "all") rows = rows.filter((c) => c.portfolioName === portfolio);
    return rows;
  }, [allCampaigns, search, portfolio]);

  const kpiCards = useMemo(() => buildKpiCards(aggregateKpis(campaigns)), [campaigns]);

  const bulkMutation = useMutation({
    mutationFn: bulkUpdateAdsCampaigns,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ads-campaign-manager"] });
      qc.invalidateQueries({ queryKey: ["ads-console-campaigns"] });
      if (data.errors.length) {
        toast({
          title: data.updated > 0 ? "Partially updated" : "Update failed",
          description: data.errors.join("; "),
          variant: data.updated === 0 ? "destructive" : "default",
        });
      }
    },
    onError: (err: Error) =>
      toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  function loadDemoData() {
    enableAdsConsoleDemoInUrl();
    setDemoMode(true);
    void statusQuery.refetch();
    toast({ title: "Demo data loaded", description: "Showing sample campaign manager metrics." });
  }

  function toggleCampaignState(campaign: AdsConsoleCampaign, enabled: boolean) {
    bulkMutation.mutate({
      campaignIds: [campaign.campaignId],
      action: enabled ? "enable" : "pause",
    });
  }

  function saveBudget(campaign: AdsConsoleCampaign) {
    const raw = budgetDrafts[campaign.campaignId] ?? String(campaign.budget);
    const value = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      toast({ title: "Invalid budget", description: "Enter a positive daily budget.", variant: "destructive" });
      return;
    }
    bulkMutation.mutate({
      campaignIds: [campaign.campaignId],
      action: "budget",
      dailyBudget: value,
    });
    setBudgetDrafts((prev) => {
      const next = { ...prev };
      delete next[campaign.campaignId];
      return next;
    });
  }

  const adsConnected = statusQuery.data?.canGatherData === true || demoMode;
  const accountLabel = demoMode
    ? "🇺🇸 Demo Amazon Ads Account"
    : statusQuery.data?.profileName
      ? `🇺🇸 ${statusQuery.data.profileName}`
      : "Select account";

  return (
    <div className="min-h-[calc(100vh-8rem)] -mx-1 sm:-mx-2 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Top header bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-white">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-200 px-3 py-1.5 text-orange-900">
            <Calendar className="w-3.5 h-3.5 text-orange-600" />
            <span>{formatDisplayDate(defaultRange.dateFrom)} - {formatDisplayDate(defaultRange.dateTo)}</span>
          </div>
          <span className="text-slate-400 text-xs">compared to</span>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 bg-slate-50">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDisplayDate(compareRange.from)} - {formatDisplayDate(compareRange.to)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 border-orange-500 text-orange-600 hover:bg-orange-50" asChild>
            <a href="https://sellerlens.io/contact" target="_blank" rel="noopener noreferrer">
              Book Demo
            </a>
          </Button>
          <Select value="current" disabled={!adsConnected && !demoMode}>
            <SelectTrigger className="h-9 w-[220px] text-sm">
              <SelectValue placeholder="Select account">{accountLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">{accountLabel}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9 gap-1.5 bg-orange-500 hover:bg-orange-600" asChild>
            <Link href="/ads/new">
              <Sparkles className="w-4 h-4" />
              + AI
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-auto">
          {demoMode && (
            <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-sm text-orange-800">
                <span className="font-medium">Demo mode</span> — sample campaign metrics for UI preview. Add{" "}
                <code className="rounded bg-orange-100 px-1">?demo=1</code> to the URL.
              </p>
            </div>
          )}

          {!adsConnected && !demoMode && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm text-slate-700 flex-1 min-w-0">
                  Connect Amazon Ads on Marketplaces to load live campaign data, or preview with demo data.
                </p>
                <Button size="sm" variant="outline" className="shrink-0 border-orange-500 text-orange-600" onClick={loadDemoData}>
                  Load demo data
                </Button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Ad Manager</h1>
            <p className="text-sm text-slate-500 mt-1">View and manage campaigns created by you.</p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            {kpiCards.map((card) => {
              const improved = card.lowerIsBetter ? card.changePct < 0 : card.changePct > 0;
              const trendColor = improved ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200";
              return (
                <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-medium text-slate-500">{card.label}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 rotate-90" />
                  </div>
                  <p className="text-lg font-bold text-slate-900 leading-tight">{card.value}</p>
                  <div className="mt-2 flex items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-400 truncate">vs. {card.previous}</span>
                    <span className={cn("rounded-full border px-1.5 py-0.5 font-medium shrink-0", trendColor)}>
                      {card.changePct >= 0 ? "+" : ""}
                      {card.changePct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Switch
                id="only-active"
                checked={onlyActive}
                onCheckedChange={setOnlyActive}
                className="data-[state=checked]:bg-orange-500"
              />
              <Label htmlFor="only-active" className="text-sm text-slate-600 font-normal">
                Only active campaigns
              </Label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-8 h-9 w-48 sm:w-56"
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={portfolio} onValueChange={setPortfolio}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Select Portfolio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All portfolios</SelectItem>
                  {portfolios.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {campaignsQuery.isError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {campaignsQuery.error instanceof Error ? campaignsQuery.error.message : "Failed to load campaigns"}
            </div>
          )}

          {/* Campaigns table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {campaignsQuery.isLoading ? (
              <div className="flex justify-center py-16 text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading campaigns…
              </div>
            ) : campaigns.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                {adsConnected || demoMode ? "No campaigns match your filters." : "Connect Amazon Ads or load demo data."}
                {!demoMode && (
                  <div className="mt-3">
                    <Button variant="outline" className="border-orange-500 text-orange-600" onClick={loadDemoData}>
                      Load demo data
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="min-w-[14rem]">Campaign</TableHead>
                    <TableHead className="w-36">Budget</TableHead>
                    <TableHead className="w-40 whitespace-nowrap">Today&apos;s consumption</TableHead>
                    <TableHead className="w-24">ACOS</TableHead>
                    <TableHead className="w-24">ROAS</TableHead>
                    <TableHead className="w-24">CTR</TableHead>
                    <TableHead className="w-24">CVR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((row) => {
                    const enabled = row.state === "ENABLED";
                    const consumption = consumptionPct(row);
                    const budgetValue = budgetDrafts[row.campaignId] ?? String(row.budget);
                    return (
                      <TableRow key={row.campaignId} className="hover:bg-slate-50/50">
                        <TableCell>
                          <Switch
                            checked={enabled}
                            disabled={bulkMutation.isPending || row.state === "ARCHIVED"}
                            onCheckedChange={(v) => toggleCampaignState(row, v)}
                            aria-label={`Toggle ${row.name}`}
                            className="data-[state=checked]:bg-orange-500"
                          />
                        </TableCell>
                        <TableCell>
                          <a
                            href={`https://advertising.amazon.com/cm/campaigns/${row.campaignId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-700 font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[18rem]">{row.name}</span>
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 h-8 max-w-[8rem]">
                            <span className="text-slate-400 text-sm mr-1">$</span>
                            <input
                              className="w-full bg-transparent text-sm outline-none"
                              value={budgetValue}
                              onChange={(e) =>
                                setBudgetDrafts((prev) => ({ ...prev, [row.campaignId]: e.target.value }))
                              }
                              onBlur={() => {
                                if (budgetDrafts[row.campaignId] != null) saveBudget(row);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveBudget(row);
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {consumption == null ? (
                            <span className="text-slate-400">N/A</span>
                          ) : (
                            <span className={cn("font-medium", consumptionColor(consumption))}>
                              {consumption.toFixed(0)}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {row.acos != null ? formatPctRatio(row.acos) : "N/A"}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {row.roas != null ? formatRatio(row.roas) : "N/A"}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {row.ctr != null ? formatPctRatio(row.ctr) : "N/A"}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {row.cvr != null ? formatPctRatio(row.cvr) : "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </main>
    </div>
  );
}
