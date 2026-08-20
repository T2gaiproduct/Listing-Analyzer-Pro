import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdsConsoleLayout } from "@/components/ads-console-layout";
import { AdsConsoleTableShell, AdsConsoleToolbar, adsStateBadge } from "@/components/ads-console-toolbar";
import { fetchAdsStatus } from "@/lib/ads-api";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Row = Record<string, unknown>;

type ViewConfig = {
  title: string;
  queryKey: string;
  fetcher: () => Promise<Record<string, unknown>>;
  dataKey: string;
  columns: Array<{ key: string; label: string; format?: (v: unknown, row: Row) => string }>;
  createHref?: string;
  showBulk?: boolean;
};

function ConnectBanner() {
  return (
    <AdsConsoleLayout>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 max-w-xl">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-900">Connect Amazon Ads</p>
            <p className="text-sm text-slate-600 mt-1">
              Connect Marketplaces and select an Ads profile to load this view.
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

export function AdsConsoleDataPage({ config }: { config: ViewConfig }) {
  const statusQuery = useQuery({ queryKey: ["ads-status"], queryFn: fetchAdsStatus });
  const dataQuery = useQuery({
    queryKey: [config.queryKey],
    queryFn: config.fetcher,
    enabled: statusQuery.data?.canGatherData === true,
    retry: false,
  });

  const rows = (dataQuery.data?.[config.dataKey] as Row[] | undefined) ?? [];

  if (!statusQuery.data?.canGatherData) return <ConnectBanner />;

  return (
    <AdsConsoleLayout>
      <AdsConsoleToolbar
        title={config.title}
        selectedCount={0}
        showBulk={config.showBulk ?? false}
        createHref={config.createHref ?? "/ads/new"}
      />

      {dataQuery.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dataQuery.error instanceof Error ? dataQuery.error.message : "Failed to load data"}
        </div>
      )}

      <AdsConsoleTableShell
        loading={dataQuery.isLoading}
        empty={!dataQuery.isLoading && rows.length === 0}
        emptyMessage={`No ${config.title.toLowerCase()} found.`}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              {config.columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={String(row.id ?? row.keywordId ?? row.adId ?? row.campaignId ?? idx)}>
                {config.columns.map((col) => {
                  const raw = row[col.key];
                  const text = col.format ? col.format(raw, row) : raw == null ? "—" : String(raw);
                  return (
                    <TableCell key={col.key} className="max-w-[16rem] truncate">
                      {col.key === "state" ? <span className={adsStateBadge(String(raw))}>{text}</span> : text}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdsConsoleTableShell>
    </AdsConsoleLayout>
  );
}
