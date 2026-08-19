import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
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
  fetchAdsConsoleCampaigns,
  type AdsConsoleCampaign,
} from "@/lib/ads-console-api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

function formatMoney(n?: number) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdsCampaignsConsolePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const statusQuery = useQuery({ queryKey: ["ads-status"], queryFn: fetchAdsStatus });
  const campaignsQuery = useQuery({
    queryKey: ["ads-console-campaigns"],
    queryFn: fetchAdsConsoleCampaigns,
    enabled: statusQuery.data?.canGatherData === true,
    retry: false,
  });

  const campaigns = campaignsQuery.data?.campaigns ?? [];

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

  if (!statusQuery.data?.canGatherData) {
    return (
      <AdsConsoleLayout>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 max-w-xl">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate-900">Connect Amazon Ads</p>
              <p className="text-sm text-slate-600 mt-1">
                Save SP-API credentials, connect your seller on Marketplaces, and select an Amazon Ads profile to load campaigns.
              </p>
              <Button className="mt-4" variant="outline" asChild>
                <Link href="/marketplaces">Go to Marketplaces</Link>
              </Button>
            </div>
          </div>
        </div>
      </AdsConsoleLayout>
    );
  }

  return (
    <AdsConsoleLayout>
      <AdsConsoleToolbar
        title="Campaigns"
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

      <AdsConsoleTableShell
        loading={campaignsQuery.isLoading}
        empty={!campaignsQuery.isLoading && campaigns.length === 0}
        emptyMessage="No campaigns found for this Ads profile."
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} aria-label="Select all" />
              </TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Today&apos;s consumption</TableHead>
              <TableHead>Targeting Type</TableHead>
              <TableHead>Sponsored Type</TableHead>
              <TableHead>Portfolio Name</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Base Budget</TableHead>
              <TableHead>Start Date</TableHead>
              {compare && <TableHead>State</TableHead>}
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
                <TableCell className="font-medium text-slate-800 max-w-[14rem] truncate">{row.name}</TableCell>
                <TableCell>{formatMoney(row.todaySpend)}</TableCell>
                <TableCell>{row.targetingType}</TableCell>
                <TableCell>{row.sponsoredType}</TableCell>
                <TableCell>{row.portfolioName ?? "—"}</TableCell>
                <TableCell>{formatMoney(row.budget)}</TableCell>
                <TableCell>{formatMoney(row.baseBudget)}</TableCell>
                <TableCell>{row.startDate ?? "—"}</TableCell>
                {compare && (
                  <TableCell>
                    <span className={adsStateBadge(row.state)}>{row.state}</span>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdsConsoleTableShell>
    </AdsConsoleLayout>
  );
}
