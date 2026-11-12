import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GeneratedContent } from "@workspace/api-client-react";
import type { ContentMarketplaceOption } from "@/lib/content-marketplaces";
import { AplusContentWizard } from "@/components/aplus-content-wizard";
import { GraphicsWizard } from "@/components/graphics-wizard";
import {
  nextProductExplorerWorkflowStep,
  type ProductExplorerWorkflowStepId,
} from "@/components/product-explorer-workflow-stepper";
import { canExportListingSource } from "@/components/listing-export-button";
import { ProductListingPreview } from "@/components/product-listing-preview";
import { ProductExportTab } from "@/components/product-export-tab";
import type { ContentVariantRow } from "@/components/listing-marketplace-content-panel";
import { ProductMiscellaneousTab } from "@/components/product-miscellaneous-tab";
import type { ReferenceResearchData } from "@/lib/reference-research";

type AuditLike = {
  id?: number;
  imageUrls?: string[] | null;
  imageRecords?: Array<{ currentUrl?: string }> | null;
  generatedImages?: unknown;
  generatedContent?: GeneratedContent | null;
  category?: string | null;
  targetKeywords?: string[] | null;
};

function collectImageUrls(
  audit: AuditLike | null | undefined,
  fallbackImageUrls?: string[] | null,
): string[] {
  const urls: string[] = [];
  const add = (url: string | undefined | null) => {
    const trimmed = url?.trim();
    if (trimmed && !urls.includes(trimmed)) urls.push(trimmed);
  };

  for (const rec of audit?.imageRecords ?? []) {
    add(rec.currentUrl);
  }
  for (const url of audit?.imageUrls ?? []) {
    add(url);
  }
  for (const url of fallbackImageUrls ?? []) {
    add(url);
  }
  return urls;
}

function WorkflowStepShell({
  children,
  showSaveAndContinue,
  onSaveAndContinue,
  isSaving,
  showStoreSync,
  storePlatformLabel,
  onSyncToStore,
  isSyncingStore,
  onBackToProducts,
}: {
  children: ReactNode;
  showSaveAndContinue: boolean;
  onSaveAndContinue?: () => void;
  isSaving?: boolean;
  showStoreSync?: boolean;
  storePlatformLabel?: string;
  onSyncToStore?: () => void;
  isSyncingStore?: boolean;
  onBackToProducts?: () => void;
}) {
  const showFooter =
    onBackToProducts
    || (showSaveAndContinue && onSaveAndContinue)
    || (showStoreSync && onSyncToStore);
  const busy = Boolean(isSaving || isSyncingStore);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
      {children}
      {showFooter && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {onBackToProducts ? (
            <button
              type="button"
              onClick={onBackToProducts}
              className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Product Explorer
            </button>
          ) : (
            <span className="min-w-0" aria-hidden />
          )}
          <div className="flex flex-wrap justify-end gap-2 ml-auto">
            {showStoreSync && onSyncToStore && storePlatformLabel && (
              <Button
                type="button"
                size="sm"
                className="h-7 text-[10px] rounded-lg bg-orange-500 hover:bg-orange-600 gap-1"
                onClick={onSyncToStore}
                disabled={busy}
              >
                {isSyncingStore ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Syncing…
                  </>
                ) : (
                  <>Save &amp; sync to {storePlatformLabel}</>
                )}
              </Button>
            )}
            {showSaveAndContinue && onSaveAndContinue && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px] rounded-lg gap-1"
                onClick={onSaveAndContinue}
                disabled={busy}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    Save &amp; Continue
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export type GraphicsStepPanel = "graphics" | "aplus";

/** Product Explorer Graphics step — Select Graphics grid + A+ (shared with Graphics in Detail). */
export function GraphicsCreateStepContent({
  auditId,
  productName,
  audit,
  productImageUrls,
}: {
  auditId: number;
  productName: string;
  audit?: AuditLike | null;
  productImageUrls?: string[] | null;
}) {
  const [graphicsStepPanel, setGraphicsStepPanel] = useState<GraphicsStepPanel>("graphics");
  const imageUrls = useMemo(
    () => collectImageUrls(audit, productImageUrls),
    [audit, productImageUrls],
  );

  return (
  <div className="space-y-3 min-w-0">
    <GraphicsStepSubTabs active={graphicsStepPanel} onChange={setGraphicsStepPanel} />
    {graphicsStepPanel === "graphics" ? (
      <div className="min-w-0 pt-1">
        <GraphicsWizard
          embedded
          createOnly
          auditId={auditId}
          productName={productName}
          imageUrls={imageUrls}
          category={audit?.category ?? null}
          targetKeywords={audit?.targetKeywords ?? null}
        />
      </div>
    ) : (
      <div className="min-w-0 pt-1">
        <AplusContentWizard embedded createOnly auditId={auditId} productName={productName} />
      </div>
    )}
  </div>
  );
}

export function GraphicsStepSubTabs({
  active,
  onChange,
}: {
  active: GraphicsStepPanel;
  onChange: (panel: GraphicsStepPanel) => void;
}) {
  const tabs: { id: GraphicsStepPanel; label: string }[] = [
    { id: "graphics", label: "Product graphics" },
    { id: "aplus", label: "A+ Content" },
  ];
  return (
    <div className="flex gap-0 border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-4 py-2.5 text-[11px] font-semibold border-b-2 transition-colors -mb-px shrink-0",
            active === tab.id
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ProductWorkflowStepContent({
  step,
  auditId,
  productName,
  brandName,
  category,
  productImageUrl,
  audit,
  generatedContent,
  existingContent,
  suggestions,
  hasGeneratedContent,
  productImageUrls,
  isOptimizing,
  onOptimize,
  optimizeDisabled,
  overviewContent,
  listingEditorContent,
  productId,
  productSource,
  listingPrice,
  listingCurrency,
  canPublishMarketplaces,
  onSaveAndContinue,
  isSavingContinue,
  showStoreSync,
  storePlatformLabel,
  onSyncToStore,
  isSyncingStore,
  onBackToProducts,
  referenceResearch,
  listingPreviewMarketplaces,
  listingPreviewMarketplaceId,
  onListingPreviewMarketplaceChange,
  contentVariants,
  contentMarketplaces,
  optimizeContentPanel,
}: {
  step: ProductExplorerWorkflowStepId;
  auditId: number;
  productName: string;
  brandName?: string | null;
  category?: string | null;
  productImageUrl?: string | null;
  audit: AuditLike | null | undefined;
  generatedContent: GeneratedContent | null | undefined;
  listingPreviewMarketplaces?: ContentMarketplaceOption[];
  listingPreviewMarketplaceId?: number;
  onListingPreviewMarketplaceChange?: (id: number) => void;
  contentVariants?: ContentVariantRow[];
  contentMarketplaces?: ContentMarketplaceOption[];
  existingContent?: {
    title: string;
    bulletPoints: string[];
    keywords: string[];
    htmlDescription: string;
  } | null;
  suggestions: string[];
  hasGeneratedContent: boolean;
  productImageUrls?: string[] | null;
  isOptimizing: boolean;
  onOptimize: () => void;
  optimizeDisabled?: boolean;
  overviewContent?: React.ReactNode;
  listingEditorContent?: React.ReactNode;
  productId?: number;
  productSource?: string;
  listingPrice?: number | null;
  listingCurrency?: string | null;
  canPublishMarketplaces?: boolean;
  onSaveAndContinue?: () => void;
  isSavingContinue?: boolean;
  showStoreSync?: boolean;
  storePlatformLabel?: string;
  onSyncToStore?: () => void;
  isSyncingStore?: boolean;
  onBackToProducts?: () => void;
  referenceResearch?: ReferenceResearchData | null;
  /** Stable React node (not an inline component) for Optimize Listing step. */
  optimizeContentPanel?: ReactNode;
}) {
  const imageUrls = useMemo(
    () => collectImageUrls(audit, productImageUrls),
    [audit, productImageUrls],
  );
  const hasNextStep = nextProductExplorerWorkflowStep(step) != null;
  const showContinueFooter = hasNextStep
    && !listingEditorContent
    && Boolean(onSaveAndContinue)
    && step !== 3;
  const showStoreSyncOnStep = Boolean(
    showStoreSync && !listingEditorContent && step >= 1 && step <= 4,
  );
  const shellProps = {
    showSaveAndContinue: showContinueFooter,
    onSaveAndContinue,
    isSaving: isSavingContinue,
    showStoreSync: showStoreSyncOnStep,
    storePlatformLabel,
    onSyncToStore,
    isSyncingStore,
    onBackToProducts,
  };

  if (step === 1) {
    if (listingEditorContent) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
          {listingEditorContent}
          {onBackToProducts && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={onBackToProducts}
                className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Product Explorer
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <WorkflowStepShell {...shellProps}>
        {overviewContent ?? (
          <p className="text-[11px] text-slate-500">Product summary and stats appear here.</p>
        )}
      </WorkflowStepShell>
    );
  }

  if (step === 2) {
    return (
      <WorkflowStepShell {...shellProps}>
        {optimizeContentPanel ?? (
          <p className="text-[11px] text-slate-500">Optimized content is unavailable.</p>
        )}
      </WorkflowStepShell>
    );
  }

  if (step === 3) {
    return (
      <WorkflowStepShell {...shellProps}>
        <GraphicsCreateStepContent
          auditId={auditId}
          productName={productName}
          audit={audit}
          productImageUrls={productImageUrls}
        />
      </WorkflowStepShell>
    );
  }

  if (step === 4) {
    return (
      <WorkflowStepShell {...shellProps}>
        <ProductListingPreview
          auditId={auditId}
          audit={audit}
          generatedContent={generatedContent}
          listingPreviewMarketplaces={listingPreviewMarketplaces}
          listingPreviewMarketplaceId={listingPreviewMarketplaceId}
          onListingPreviewMarketplaceChange={onListingPreviewMarketplaceChange}
          productName={productName}
          brandName={brandName}
          category={category}
          productImageUrl={productImageUrl}
          fallbackImageUrls={productImageUrls}
          edgeToEdge
          showExportButton
          exportDisabled={!canExportListingSource(productSource)}
          sharePreviewLink
          generatedOnly
          referenceIntelligence={referenceResearch?.intelligence ?? null}
          productDetails={referenceResearch?.productDetails ?? null}
        />
      </WorkflowStepShell>
    );
  }

  if (step === 5 && productId && productSource) {
    return (
      <WorkflowStepShell {...shellProps}>
        <ProductExportTab
          productId={productId}
          auditId={auditId}
          productSource={productSource}
          productName={productName}
          contentVariants={contentVariants ?? []}
          contentMarketplaces={contentMarketplaces ?? []}
          canPublishMarketplaces={canPublishMarketplaces}
        />
      </WorkflowStepShell>
    );
  }

  if (step === 6 && productId && productSource) {
    return (
      <WorkflowStepShell showSaveAndContinue={false} onBackToProducts={onBackToProducts}>
        <ProductMiscellaneousTab
          productId={productId}
          productSource={productSource}
          productName={productName}
          category={category}
          listingPrice={listingPrice}
          listingCurrency={listingCurrency}
        />
      </WorkflowStepShell>
    );
  }

  return null;
}
