import { useMemo, type ReactNode } from "react";
import { ArrowRight, ImageIcon, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeneratedContent } from "@workspace/api-client-react";
import { AplusContentWizard } from "@/components/aplus-content-wizard";
import { GraphicsWizard } from "@/components/graphics-wizard";
import {
  nextProductExplorerWorkflowStep,
  type ProductExplorerWorkflowStepId,
} from "@/components/product-explorer-workflow-stepper";
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

function WorkflowStepShell({
  children,
  showSaveAndContinue,
  onSaveAndContinue,
  isSaving,
}: {
  children: ReactNode;
  showSaveAndContinue: boolean;
  onSaveAndContinue?: () => void;
  isSaving?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      {children}
      {showSaveAndContinue && onSaveAndContinue && (
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button
            type="button"
            size="sm"
            className="h-8 text-[11px] rounded-xl bg-orange-500 hover:bg-orange-600 gap-1.5"
            onClick={onSaveAndContinue}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                Save &amp; Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
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
  onSaveAndContinue,
  isSavingContinue,
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
  onSaveAndContinue?: () => void;
  isSavingContinue?: boolean;
  OptimizedContentPanel: React.ComponentType<{
    generatedContent: GeneratedContent | null | undefined;
    isOptimizing: boolean;
    onOptimize: () => void;
    optimizeDisabled?: boolean;
  }>;
}) {
  const imageUrls = useMemo(() => collectImageUrls(audit), [audit]);
  const hasNextStep = nextProductExplorerWorkflowStep(step) != null;
  const showFooter = hasNextStep && !listingEditorContent && Boolean(onSaveAndContinue);

  if (step === 1) {
    return (
      <WorkflowStepShell
        showSaveAndContinue={showFooter}
        onSaveAndContinue={onSaveAndContinue}
        isSaving={isSavingContinue}
      >
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
      </WorkflowStepShell>
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
      <WorkflowStepShell
        showSaveAndContinue={showFooter}
        onSaveAndContinue={onSaveAndContinue}
        isSaving={isSavingContinue}
      >
        {overviewContent ?? (
          <p className="text-[11px] text-slate-500">Product summary and stats appear here.</p>
        )}
      </WorkflowStepShell>
    );
  }

  if (step === 3) {
    return (
      <WorkflowStepShell
        showSaveAndContinue={showFooter}
        onSaveAndContinue={onSaveAndContinue}
        isSaving={isSavingContinue}
      >
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
      </WorkflowStepShell>
    );
  }

  if (step === 4) {
    return (
      <WorkflowStepShell
        showSaveAndContinue={showFooter}
        onSaveAndContinue={onSaveAndContinue}
        isSaving={isSavingContinue}
      >
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
      </WorkflowStepShell>
    );
  }

  if (step === 5) {
    return (
      <WorkflowStepShell
        showSaveAndContinue={showFooter}
        onSaveAndContinue={onSaveAndContinue}
        isSaving={isSavingContinue}
      >
        <AplusContentWizard embedded auditId={auditId} productName={productName} />
      </WorkflowStepShell>
    );
  }

  if (step === 6 && productId && productSource) {
    return (
      <WorkflowStepShell
        showSaveAndContinue={showFooter}
        onSaveAndContinue={onSaveAndContinue}
        isSaving={isSavingContinue}
      >
        <ProductMarketplacesTab productId={productId} source={productSource} enabled />
      </WorkflowStepShell>
    );
  }

  if (step === 7 && productId && productSource) {
    return (
      <WorkflowStepShell
        showSaveAndContinue={showFooter}
        onSaveAndContinue={onSaveAndContinue}
        isSaving={isSavingContinue}
      >
        <ProductOrdersTab productId={productId} source={productSource} enabled />
      </WorkflowStepShell>
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
