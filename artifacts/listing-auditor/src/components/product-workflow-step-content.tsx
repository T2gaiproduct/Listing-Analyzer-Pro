import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Sparkles, Upload } from "lucide-react";
import type { GeneratedContent } from "@workspace/api-client-react";
import { AplusModuleGallery, type AplusModuleItem } from "@/components/aplus-module-gallery";
import { GraphicsWizard } from "@/components/graphics-wizard";
import type { ProductExplorerWorkflowStepId } from "@/components/product-explorer-workflow-stepper";
import { ProductMarketplacesTab } from "@/components/product-marketplaces-tab";
import { ProductOrdersTab } from "@/components/product-orders-tab";
import { ProductSalesTab } from "@/components/product-sales-tab";

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
  overviewContent,
  listingEditorContent,
  productId,
  productSource,
  OptimizedContentPanel,
}: {
  step: ProductExplorerWorkflowStepId;
  auditId: number;
  productName: string;
  audit: AuditLike | null | undefined;
  generatedContent: GeneratedContent | null | undefined;
  isOptimizing: boolean;
  onOptimize: () => void;
  optimizeDisabled?: boolean;
  overviewContent?: React.ReactNode;
  listingEditorContent?: React.ReactNode;
  productId?: number;
  productSource?: string;
  OptimizedContentPanel: React.ComponentType<{
    generatedContent: GeneratedContent | null | undefined;
    isOptimizing: boolean;
    onOptimize: () => void;
    optimizeDisabled?: boolean;
  }>;
}) {
  const imageUrls = useMemo(() => collectImageUrls(audit), [audit]);
  const [aplusModules, setAplusModules] = useState<AplusModuleItem[]>([]);

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
    if (listingEditorContent) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          {listingEditorContent}
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        {overviewContent ?? (
          <p className="text-[11px] text-slate-500">Product summary and stats appear here.</p>
        )}
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-slate-900">Listing content</h3>
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

  if (step === 4) {
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

  if (step === 5) {
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

  if (step === 6 && productId && productSource) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <ProductMarketplacesTab productId={productId} source={productSource} enabled />
      </div>
    );
  }

  if (step === 7 && productId && productSource) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <ProductOrdersTab productId={productId} source={productSource} enabled />
      </div>
    );
  }

  if (step === 8 && productId && productSource) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <ProductSalesTab productId={productId} source={productSource} enabled />
      </div>
    );
  }

  return null;
}
