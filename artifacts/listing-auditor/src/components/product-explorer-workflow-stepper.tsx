import type { ElementType } from "react";
import {
  Eye,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Store,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProductExplorerWorkflowStepId = 1 | 2 | 3 | 4 | 5 | 6;

export const PRODUCT_EXPLORER_WORKFLOW_STEPS: {
  id: ProductExplorerWorkflowStepId;
  key: string;
  label: string;
  sub: string;
  icon: ElementType;
}[] = [
  { id: 1, key: "overview", label: "OVERVIEW", sub: "Product summary", icon: LayoutDashboard },
  { id: 2, key: "listing", label: "OPTIMIZE LISTING", sub: "Create optimized content", icon: FileText },
  { id: 3, key: "graphics", label: "GRAPHICS", sub: "Product graphics & A+", icon: ImageIcon },
  { id: 4, key: "listing_preview", label: "LISTING PREVIEW", sub: "Amazon-style preview", icon: Eye },
  { id: 5, key: "marketplaces", label: "MARKETPLACES", sub: "List & publish", icon: Store },
  { id: 6, key: "miscellaneous", label: "MISCELLANEOUS", sub: "Orders & sales", icon: Boxes },
];

/** Map API audit `currentStep` (1–5) to Product Explorer UI step (1–7). */
export function apiStepToProductExplorerStep(
  currentStep: number | null | undefined,
): ProductExplorerWorkflowStepId {
  const apiStep = Math.min(5, Math.max(1, currentStep ?? 1));
  if (apiStep <= 3) return apiStep as ProductExplorerWorkflowStepId;
  return 4;
}

/** Returns API step to persist, or null for local-only steps (Overview, Listing preview, Marketplaces+). */
export function productExplorerStepToApiStep(
  peStep: ProductExplorerWorkflowStepId,
): number | null {
  if (peStep === 1) return null;
  if (peStep >= 5) return null; // Marketplaces, Miscellaneous, Orders, Sales are local-only
  if (peStep === 4) return null;
  if (peStep === 2) return 2;
  if (peStep === 3) return 3;
  return null;
}

/** API step to persist when leaving a step via Save & Continue. */
export function productExplorerSaveContinueApiStep(
  fromStep: ProductExplorerWorkflowStepId,
): number | null {
  const nextStep = Math.min(6, fromStep + 1) as ProductExplorerWorkflowStepId;
  const nextApi = productExplorerStepToApiStep(nextStep);
  if (nextApi != null) return nextApi;
  if (fromStep === 3) return 5;
  return productExplorerStepToApiStep(fromStep);
}

export function nextProductExplorerWorkflowStep(
  step: ProductExplorerWorkflowStepId,
): ProductExplorerWorkflowStepId | null {
  if (step >= 6) return null;
  return (step + 1) as ProductExplorerWorkflowStepId;
}

export type ProductExplorerStepCompletionInput = {
  imageUrls?: string[] | null;
  imageRecords?: Array<{ currentUrl?: string | null }> | null;
  productImageUrl?: string | null;
  generatedContent?: {
    title?: string | null;
    bulletPoints?: string[] | null;
    htmlDescription?: string | null;
  } | null;
  title?: string | null;
  bulletPoints?: string[] | null;
  generatedImages?: unknown;
  liveMarketplaceCount?: number;
  marketplaceActiveCount?: number;
  totalOrders?: number;
  totalRevenue?: number | null;
  /** @deprecated References tab removed; attributes live on Overview / Upload. */
  referenceResearchAnalyzedAt?: string | null;
};

/** User-uploaded source images only — not generated graphics / listing thumbnails. */
function countSourceImages(input: ProductExplorerStepCompletionInput): number {
  let count = 0;
  for (const url of input.imageUrls ?? []) {
    if (url?.trim()) count += 1;
  }
  return count;
}

function hasListingContent(input: ProductExplorerStepCompletionInput): boolean {
  const generated = input.generatedContent;
  if (generated?.title?.trim()) {
    return Boolean(
      generated.bulletPoints?.some((b) => b.trim())
      || generated.htmlDescription?.trim(),
    );
  }
  return Boolean(input.title?.trim() && input.bulletPoints?.some((b) => b.trim()));
}

function hasGeneratedGraphics(input: ProductExplorerStepCompletionInput): boolean {
  if (input.imageRecords?.some((rec) => rec.currentUrl?.trim())) return true;
  const generated = input.generatedImages as {
    main?: string[];
    lifestyle?: string[];
    infographic?: string[];
  } | null | undefined;
  if (!generated) return false;
  return [...(generated.main ?? []), ...(generated.lifestyle ?? []), ...(generated.infographic ?? [])]
    .some((url) => Boolean(url?.trim()));
}

function hasAplusContent(generatedImages: unknown): boolean {
  const aplus = (generatedImages as { aplus?: { modules?: unknown[]; status?: string } } | null)?.aplus;
  if (!aplus) return false;
  if (aplus.status === "completed") return true;
  return (aplus.modules?.length ?? 0) > 0;
}

/** Step completion from actual product/audit data (not API currentStep alone). */
export function productExplorerStepCompletedFromData(
  input: ProductExplorerStepCompletionInput,
): Record<ProductExplorerWorkflowStepId, boolean> {
  const uploadDone = countSourceImages(input) > 0;
  const listingDone = hasListingContent(input);
  const graphicsDone = hasGeneratedGraphics(input);
  const aplusDone = hasAplusContent(input.generatedImages);
  const previewReady = listingDone && (graphicsDone || uploadDone || Boolean(input.productImageUrl?.trim()));
  const marketplacesDone = (input.liveMarketplaceCount ?? 0) > 0
    || (input.marketplaceActiveCount ?? 0) > 0;
  const ordersDone = (input.totalOrders ?? 0) > 0;
  const salesDone = (input.totalRevenue ?? 0) > 0;

  return {
    1: uploadDone || listingDone || Boolean(input.productImageUrl?.trim()),
    2: listingDone,
    3: graphicsDone || aplusDone,
    4: previewReady,
    5: marketplacesDone,
    6: ordersDone || salesDone || Boolean(input.productImageUrl?.trim()) || uploadDone,
  };
}

/** Open on Overview when entering Product Explorer; users pick the next step from the tab bar. */
export function resolveInitialProductExplorerStep(
  _completed: Record<ProductExplorerWorkflowStepId, boolean>,
  _currentStep: number | null | undefined,
  _opts?: { forceOverview?: boolean },
): ProductExplorerWorkflowStepId {
  return 1;
}

/** @deprecated Use productExplorerStepCompletedFromData — currentStep alone over-marked steps complete. */
export function productExplorerStepCompletedFromCurrentStep(
  currentStep: number | null | undefined,
  status?: string | null,
): Record<ProductExplorerWorkflowStepId, boolean> {
  const apiStep = Math.min(5, Math.max(1, currentStep ?? 1));
  const complete = status === "complete";
  return {
    1: complete || apiStep > 1,
    2: complete || apiStep > 2,
    3: complete || apiStep > 3,
    4: complete || apiStep >= 4,
    5: complete || apiStep >= 5,
    6: complete || apiStep >= 5,
  };
}

interface ProductExplorerWorkflowStepperProps {
  activeStep: ProductExplorerWorkflowStepId;
  stepCompleted?: Partial<Record<ProductExplorerWorkflowStepId, boolean>>;
  onStepClick?: (stepId: ProductExplorerWorkflowStepId) => void;
  className?: string;
}

export function ProductExplorerWorkflowStepper({
  activeStep,
  stepCompleted = {},
  onStepClick,
  className,
}: ProductExplorerWorkflowStepperProps) {
  return (
    <div
      className={cn(
        "border border-border bg-card rounded-lg overflow-x-auto flex-shrink-0",
        className,
      )}
    >
      <div className="flex items-stretch min-w-[32rem] w-full">
        {PRODUCT_EXPLORER_WORKFLOW_STEPS.map((s) => {
          const isActive = activeStep === s.id;
          const clickable = Boolean(onStepClick);
          const StepIcon = s.icon;

          return (
            <button
              key={s.id}
              type="button"
              disabled={!clickable}
              onClick={() => onStepClick?.(s.id)}
              className={cn(
                "flex-1 min-w-[2.5rem] flex flex-col items-center py-2 gap-0.5 border-b-2 transition-all text-center px-0.5",
                isActive ? "border-orange-500" : "border-transparent",
                clickable && !isActive && "hover:border-border cursor-pointer",
                !clickable && "cursor-default",
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                  isActive
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-card border-border text-muted-foreground",
                )}
              >
                <StepIcon className="w-3 h-3" strokeWidth={2.25} />
              </div>
              <p
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-wide leading-none whitespace-nowrap",
                  isActive ? "text-orange-500" : "text-muted-foreground",
                )}
              >
                {s.label}
              </p>
              <p
                className={cn(
                  "text-[9px] leading-tight hidden lg:block",
                  isActive ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {s.sub}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
