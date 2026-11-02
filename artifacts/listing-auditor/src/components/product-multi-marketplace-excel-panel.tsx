import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { downloadMultiMarketplaceExcel } from "@/lib/amazon-export";
import type { ContentMarketplaceOption } from "@/lib/content-marketplaces";
import type { ContentVariantRow } from "@/components/listing-marketplace-content-panel";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function variantHasExportCopy(row: ContentVariantRow): boolean {
  const c = row.generatedContent;
  return Boolean(
    c?.title?.trim()
    || c?.bulletPoints?.some((b) => b?.trim())
    || c?.keywords?.some((k) => k?.trim())
    || c?.htmlDescription?.trim()
    || (c?.attributes?.length ?? 0) > 0,
  );
}

export function ProductMultiMarketplaceExcelPanel({
  auditId,
  productName,
  contentVariants,
  contentMarketplaces,
}: {
  auditId: number;
  productName?: string;
  contentVariants: ContentVariantRow[];
  contentMarketplaces: ContentMarketplaceOption[];
}) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const includedMarketplaces = useMemo(() => {
    const ids = new Set(
      contentVariants.filter(variantHasExportCopy).map((v) => v.contentMarketplaceId),
    );
    return contentMarketplaces.filter((m) => ids.has(m.id));
  }, [contentVariants, contentMarketplaces]);

  const canDownload = auditId > 0 && includedMarketplaces.length > 0;

  async function handleDownload() {
    if (!canDownload || downloading) return;
    setDownloading(true);
    try {
      await downloadMultiMarketplaceExcel({ auditId, basePath });
      toast({
        title: "Workbook downloaded",
        description: productName
          ? `Multi-marketplace Excel for ${productName}.`
          : "Multi-marketplace Excel download started.",
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not export.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Multi-marketplace workbook</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            One Excel file with <span className="font-medium text-slate-700">Products</span>,{" "}
            <span className="font-medium text-slate-700">Image Order</span>, and a separate sheet per marketplace where you generated and saved optimized copy.
          </p>
        </div>
      </div>

      {includedMarketplaces.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Sheets included
          </p>
          <ul className="flex flex-wrap gap-1.5">
            <li className="text-[10px] font-medium bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-700">
              Products
            </li>
            <li className="text-[10px] font-medium bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-700">
              Image Order
            </li>
            {includedMarketplaces.map((m) => (
              <li
                key={m.id}
                className="text-[10px] font-medium bg-white border border-emerald-200 rounded px-2 py-0.5 text-emerald-900"
              >
                {m.name}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          Generate optimized content on at least one marketplace tab in Optimize Listing, then click Save on each tab before exporting.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          className="h-8 text-[11px] gap-1.5 bg-orange-500 hover:bg-orange-600"
          disabled={!canDownload || downloading}
          onClick={() => void handleDownload()}
        >
          {downloading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Preparing…
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              Download Excel workbook
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
