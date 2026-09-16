import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  type AmazonMarketplaceId,
  downloadAuditExport,
} from "@/lib/amazon-export";

const DEFAULT_EXPORT_MARKETPLACE: AmazonMarketplaceId = "US";
import { fetchJson } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type ExportPreviewRow = {
  section: string;
  amazonField: string;
  value: string;
  charCount: number;
  status: "complete" | "missing" | "optional";
};

type ExportPreviewResponse = {
  readinessScore: number;
  readinessMax: number;
  readinessHint: string;
  rows: ExportPreviewRow[];
  canDownload: boolean;
};

function StatusPill({ status }: { status: ExportPreviewRow["status"] }) {
  if (status === "complete") {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
        Ready
      </span>
    );
  }
  if (status === "missing") {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
        Missing
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
      Optional
    </span>
  );
}

export function BuildBrandExportStep({
  auditId,
  marketplace = DEFAULT_EXPORT_MARKETPLACE,
  onSaveProduct,
  isSaving,
}: {
  auditId: number;
  /** Used for export preview/download field mapping (defaults to US). */
  marketplace?: AmazonMarketplaceId;
  onSaveProduct: () => void;
  isSaving?: boolean;
}) {
  const [downloading, setDownloading] = useState<"csv" | "excel" | null>(null);
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-export-preview", auditId, marketplace],
    queryFn: () =>
      fetchJson<ExportPreviewResponse>(
        `${basePath}/api/audits/${auditId}/export/preview?marketplace=${marketplace}`,
      ),
    enabled: auditId > 0,
    staleTime: 10_000,
  });

  async function handleDownload(format: "csv" | "excel") {
    setDownloading(format);
    try {
      await downloadAuditExport({
        auditId,
        format,
        platform: "amazon",
        marketplace,
        basePath,
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  }

  const readinessPercent = data
    ? Math.round((data.readinessScore / Math.max(1, data.readinessMax)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Export listing package</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review Amazon upload fields, then download CSV or Excel. Image fields use public URLs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[12rem_1fr] gap-6">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center text-center">
          <div
            className="w-24 h-24 rounded-full border-4 border-orange-200 flex items-center justify-center text-2xl font-bold text-orange-600"
            aria-label="Listing readiness"
          >
            {isLoading ? "…" : readinessPercent}
          </div>
          <p className="text-sm font-semibold text-foreground mt-3">Listing readiness</p>
          <p className="text-xs text-muted-foreground mt-2 leading-snug">
            {data?.readinessHint ?? "Loading export summary…"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden min-w-0">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Amazon upload data
            </p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading export table…
            </div>
          ) : isError ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-destructive">Could not load export preview.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm min-w-[40rem]">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Section</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Amazon field</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Value</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground w-20">Chars</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((row, index) => (
                    <tr key={`${row.section}-${row.amazonField}-${index}`} className="border-b border-border/60 align-top">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.section}</td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{row.amazonField}</td>
                      <td className={cn(
                        "px-3 py-2 max-w-md break-all",
                        row.value.startsWith("http") && "text-blue-700 underline-offset-2",
                      )}>
                        {row.value || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.charCount}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onSaveProduct}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save product
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!data?.canDownload || downloading !== null}
          onClick={() => void handleDownload("csv")}
        >
          {downloading === "csv" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!data?.canDownload || downloading !== null}
          onClick={() => void handleDownload("excel")}
        >
          {downloading === "excel" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" />
          )}
          Download Excel
        </Button>
      </div>
    </div>
  );
}
