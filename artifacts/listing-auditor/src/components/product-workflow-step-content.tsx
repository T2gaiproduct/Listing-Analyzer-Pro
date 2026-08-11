import { useEffect, useMemo, useState } from "react";
import { Download, ImageIcon, Pencil, Send, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GeneratedContent } from "@workspace/api-client-react";
import { AplusModuleGallery, type AplusModuleItem } from "@/components/aplus-module-gallery";
import { GraphicsWizard } from "@/components/graphics-wizard";
import {
  AMAZON_MARKETPLACES,
  EXPORT_PLATFORMS,
  downloadAuditExport,
  type AmazonMarketplaceId,
  type ExportPlatform,
} from "@/lib/amazon-export";
import type { BuildBrandWorkflowStepId } from "@/components/build-brand-workflow-stepper";
import { cn } from "@/lib/utils";

type AuditLike = {
  id?: number;
  imageUrls?: string[] | null;
  imageRecords?: Array<{ currentUrl?: string }> | null;
  generatedImages?: unknown;
  generatedContent?: GeneratedContent | null;
  category?: string | null;
  targetKeywords?: string[] | null;
};

function collectImageUrls(audit: AuditLike | null | undefined): string[] {
  const urls: string[] = [];
  for (const rec of audit?.imageRecords ?? []) {
    const url = rec.currentUrl?.trim();
    if (url && !urls.includes(url)) urls.push(url);
  }
  for (const url of audit?.imageUrls ?? []) {
    const trimmed = url?.trim();
    if (trimmed && !urls.includes(trimmed)) urls.push(trimmed);
  }
  return urls;
}

function readAplusModules(generatedImages: unknown): AplusModuleItem[] {
  const modules = (generatedImages as { aplus?: { modules?: AplusModuleItem[] } } | null)?.aplus?.modules;
  return Array.isArray(modules) ? modules : [];
}

export function ProductWorkflowStepContent({
  step,
  auditId,
  productName,
  audit,
  generatedContent,
  isOptimizing,
  onOptimize,
  optimizeDisabled,
  onEditListing,
  canEditListing,
  canPublishToStore,
  canPublishToAmazon,
  onPublishToStore,
  onPublishToAmazon,
  isPublishingToStore,
  isPublishingToAmazon,
  storePlatformLabel,
  OptimizedContentPanel,
}: {
  step: BuildBrandWorkflowStepId;
  auditId: number;
  productName: string;
  audit: AuditLike | null | undefined;
  generatedContent: GeneratedContent | null | undefined;
  isOptimizing: boolean;
  onOptimize: () => void;
  optimizeDisabled?: boolean;
  onEditListing: () => void;
  canEditListing: boolean;
  canPublishToStore: boolean;
  canPublishToAmazon: boolean;
  onPublishToStore: () => void;
  onPublishToAmazon: () => void;
  isPublishingToStore: boolean;
  isPublishingToAmazon: boolean;
  storePlatformLabel?: string;
  OptimizedContentPanel: React.ComponentType<{
    generatedContent: GeneratedContent | null | undefined;
    isOptimizing: boolean;
    onOptimize: () => void;
    optimizeDisabled?: boolean;
  }>;
}) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const imageUrls = useMemo(() => collectImageUrls(audit), [audit]);
  const [aplusModules, setAplusModules] = useState<AplusModuleItem[]>([]);
  const [exportPlatform, setExportPlatform] = useState<ExportPlatform>("amazon");
  const [exportMarketplace, setExportMarketplace] = useState<AmazonMarketplaceId>("US");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setAplusModules(readAplusModules(audit?.generatedImages));
  }, [audit?.generatedImages]);

  if (step === 1) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-slate-900">Upload product images</h3>
        </div>
        {imageUrls.length === 0 ? (
          <p className="text-[11px] text-slate-500 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            No images uploaded yet. Add product images to continue with listing and graphics.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {imageUrls.map((url) => (
              <div key={url} className="aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-slate-900">Listing content</h3>
          </div>
          {canEditListing && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={onEditListing}>
              <Pencil className="w-3 h-3 mr-1 opacity-70" />
              Edit listing
            </Button>
          )}
        </div>
        <OptimizedContentPanel
          generatedContent={generatedContent}
          isOptimizing={isOptimizing}
          onOptimize={onOptimize}
          optimizeDisabled={optimizeDisabled}
        />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-slate-900">Product graphics</h3>
        </div>
        <GraphicsWizard
          embedded
          auditId={auditId}
          productName={productName}
          imageUrls={audit?.imageUrls ?? null}
          category={audit?.category ?? null}
          targetKeywords={audit?.targetKeywords ?? null}
        />
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-slate-900">A+ content</h3>
        </div>
        {aplusModules.length > 0 ? (
          <AplusModuleGallery
            auditId={auditId}
            modules={aplusModules}
            onModulesUpdate={setAplusModules}
            onLightbox={() => undefined}
          />
        ) : (
          <p className="text-[11px] text-slate-500 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
            Complete listing and graphics steps, then generate A+ modules here when available.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-slate-900">Export &amp; publish</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-700">Platform</label>
          <Select value={exportPlatform} onValueChange={(v) => setExportPlatform(v as ExportPlatform)}>
            <SelectTrigger className="h-9 text-xs rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_PLATFORMS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {exportPlatform === "amazon" && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-700">Amazon marketplace</label>
            <Select
              value={exportMarketplace}
              onValueChange={(v) => setExportMarketplace(v as AmazonMarketplaceId)}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {AMAZON_MARKETPLACES.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>
                    {mp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[11px]"
          disabled={exporting}
          onClick={() => {
            setExporting(true);
            void downloadAuditExport({
              auditId,
              format: "excel",
              platform: exportPlatform,
              marketplace: exportPlatform === "amazon" ? exportMarketplace : undefined,
              basePath,
            })
              .catch(() => undefined)
              .finally(() => setExporting(false));
          }}
        >
          <Download className="w-3 h-3 mr-1" />
          Download Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[11px]"
          disabled={exporting}
          onClick={() => {
            setExporting(true);
            void downloadAuditExport({
              auditId,
              format: "zip",
              platform: exportPlatform,
              marketplace: exportPlatform === "amazon" ? exportMarketplace : undefined,
              basePath,
            })
              .catch(() => undefined)
              .finally(() => setExporting(false));
          }}
        >
          <Download className="w-3 h-3 mr-1" />
          Download ZIP
        </Button>
        {canPublishToStore && (
          <Button
            type="button"
            size="sm"
            className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700"
            onClick={onPublishToStore}
            disabled={isPublishingToStore}
          >
            <Send className="w-3 h-3 mr-1" />
            {isPublishingToStore ? "Publishing…" : `Publish to ${storePlatformLabel ?? "store"}`}
          </Button>
        )}
        {canPublishToAmazon && (
          <Button
            type="button"
            size="sm"
            className={cn("h-8 text-[11px]", "bg-amber-600 hover:bg-amber-700")}
            onClick={onPublishToAmazon}
            disabled={isPublishingToAmazon}
          >
            <Send className="w-3 h-3 mr-1" />
            {isPublishingToAmazon ? "Publishing…" : "Publish to Amazon"}
          </Button>
        )}
      </div>
    </div>
  );
}
