import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  AlignLeft,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Copy,
  Eye,
  Image as ImageLucide,
  Lightbulb,
  Loader2,
  Package,
  Pencil,
  Sparkles,
  Star,
  Tag,
  Type,
} from "lucide-react";
import { useGetAudit, getGetAuditQueryKey, useGenerateContent } from "@workspace/api-client-react";
import type { AuditResult, GeneratedContent } from "@workspace/api-client-react";
import { normalizeStoreImportProductDetail } from "@/lib/store-import-product-detail";
import { fetchShopifyStatus, publishAuditToShopify } from "@/lib/shopify-publish";
import { fetchWooCommerceStatus, publishAuditToWooCommerce } from "@/lib/woocommerce-publish";
import { fetchAmazonStatus, publishAuditToAmazon } from "@/lib/amazon-publish";
import { ScoreBadge, ScoreRing } from "@/components/score-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ApiFetchError, fetchJson } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { refreshCreditBalances } from "@/lib/credit-queries";
import {
  mapAuditToProductDetail,
  mapGraphicsToProductDetail,
  type ProductDetailView,
} from "@/lib/product-mappers";
import { ProductDetailRibbon } from "@/components/product-detail-ribbon";
import { MarketplaceLogo } from "@/components/marketplace-logos";
import {
  ProductExplorerWorkflowStepper,
  apiStepToProductExplorerStep,
  nextProductExplorerWorkflowStep,
  productExplorerSaveContinueApiStep,
  productExplorerStepCompletedFromCurrentStep,
  type ProductExplorerWorkflowStepId,
} from "@/components/product-explorer-workflow-stepper";
import { ProductWorkflowStepContent } from "@/components/product-workflow-step-content";

type ProductSourceType = "listing" | "audit" | "graphics" | "video" | "ads";

function parseProductSource(raw: string | null): ProductSourceType | null {
  if (raw === "listing" || raw === "audit" || raw === "graphics" || raw === "video" || raw === "ads") {
    return raw;
  }
  return null;
}

async function fetchProductDetail(id: number, source: ProductSourceType | null): Promise<ProductDetailView> {
  const sourceQuery = source ? `?source=${source}` : "";
  try {
    return await fetchJson<ProductDetailView>(`${basePath}/api/products/${id}${sourceQuery}`);
  } catch (error) {
    if (!(error instanceof ApiFetchError) || error.status !== 404 || source !== "graphics") {
      throw error;
    }
    const graphics = await fetchJson<{
      id: number;
      name: string;
      productName: string;
      category?: string | null;
      status: string;
      sourceImageUrls?: string[] | null;
      imageRecords?: Array<{ currentUrl?: string }> | null;
      generatedCount?: number;
      createdAt?: string;
      updatedAt?: string;
    }>(`${basePath}/api/graphics/projects/${id}`);
    return mapGraphicsToProductDetail(graphics);
  }
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function isStoreImportProduct(product?: Pick<ProductDetailView, "isShopifyImport" | "isWooCommerceImport"> | null): boolean {
  return Boolean(product?.isShopifyImport || product?.isWooCommerceImport);
}

type ProductEditForm = {
  productName: string;
  sku: string;
  brandName: string;
  category: string;
  assignedManager: string;
  priority: "high" | "medium" | "low";
  notes: string;
  listingTitle: string;
  bulletPointsText: string;
  tagsText: string;
  descriptionHtml: string;
  price: string;
};

type MarketplaceSyncPlatformResult = {
  ok: boolean;
  listingUrl?: string | null;
  warning?: string;
  error?: string;
};

type MarketplaceSyncResult = {
  shopify?: MarketplaceSyncPlatformResult;
  woocommerce?: MarketplaceSyncPlatformResult;
  amazon?: MarketplaceSyncPlatformResult;
  synced: boolean;
};

function extractMarketplaceSync(payload: unknown): MarketplaceSyncResult | null {
  if (!payload || typeof payload !== "object") return null;
  const sync = (payload as { marketplaceSync?: MarketplaceSyncResult }).marketplaceSync;
  return sync ?? null;
}

const MARKETPLACE_SYNC_LABELS: Record<"shopify" | "woocommerce" | "amazon", string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  amazon: "Amazon",
};

function describeMarketplaceSyncResult(sync: MarketplaceSyncResult | null | undefined): {
  syncedPlatforms: string[];
  warnings: string[];
  errors: string[];
} {
  const syncedPlatforms: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const key of ["shopify", "woocommerce", "amazon"] as const) {
    const entry = sync?.[key];
    if (!entry) continue;
    if (entry.ok) {
      syncedPlatforms.push(MARKETPLACE_SYNC_LABELS[key]);
      if (entry.warning?.trim()) warnings.push(entry.warning.trim());
    } else if (entry.error?.trim()) {
      errors.push(`${MARKETPLACE_SYNC_LABELS[key]}: ${entry.error.trim()}`);
    }
  }

  return { syncedPlatforms, warnings, errors };
}

function bulletsToTextarea(bullets: string[] | undefined): string {
  return (bullets ?? []).filter(Boolean).join("\n");
}

function parseBulletTextarea(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function tagsToTextarea(tags: string[] | undefined): string {
  return (tags ?? []).filter(Boolean).join(", ");
}

function parseTagsTextarea(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatListingPrice(price: number | null | undefined, currency: string | null | undefined): string {
  if (price == null || Number.isNaN(price) || price <= 0) return "";
  return price.toFixed(2);
}

function parsePriceInput(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizePriceField(value: string | undefined): string {
  const parsed = parsePriceInput(value);
  return parsed != null ? parsed.toFixed(2) : "";
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolvePositivePrice(...candidates: Array<number | null | undefined>): number | null {
  for (const candidate of candidates) {
    if (candidate != null && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }
  return null;
}

function listingDraftStorageKey(productId: number): string {
  return `listing-editor-draft:${productId}`;
}

function readListingDraft(productId: number): ProductEditForm | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(listingDraftStorageKey(productId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductEditForm;
    if (typeof parsed.listingTitle !== "string" || typeof parsed.sku !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeListingDraft(productId: number, form: ProductEditForm): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(listingDraftStorageKey(productId), JSON.stringify(form));
  } catch {
    // ignore storage quota errors
  }
}

function clearListingDraft(productId: number): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(listingDraftStorageKey(productId));
}

function mergeListingEditForm(base: ProductEditForm, draft: ProductEditForm | null): ProductEditForm {
  if (!draft) return { ...base, price: normalizePriceField(base.price) };
  const draftPrice = parsePriceInput(draft.price);
  const basePrice = parsePriceInput(base.price);
  const mergedPrice = draftPrice != null
    ? normalizePriceField(draft.price)
    : basePrice != null
      ? normalizePriceField(base.price)
      : "";
  return {
    ...base,
    ...draft,
    listingTitle: draft.listingTitle.trim() || base.listingTitle,
    sku: draft.sku.trim() || base.sku,
    price: mergedPrice,
    brandName: draft.brandName.trim() || base.brandName,
    category: draft.category.trim() || base.category,
    bulletPointsText: draft.bulletPointsText.trim() || base.bulletPointsText,
    tagsText: draft.tagsText.trim() || base.tagsText,
    descriptionHtml: draft.descriptionHtml.trim() || base.descriptionHtml,
  };
}

function buildListingEditForm(
  product: ProductDetailView,
  audit?: {
    title?: string | null;
    bulletPoints?: string[];
    targetKeywords?: string[];
    brandName?: string | null;
    category?: string | null;
    generatedContent?: GeneratedContent | null;
  } | null,
): ProductEditForm {
  const generatedBullets = audit?.generatedContent?.bulletPoints?.filter(Boolean) ?? [];
  const auditBullets = audit?.bulletPoints?.filter(Boolean) ?? [];
  const productBullets = product.bulletPoints?.filter(Boolean) ?? [];
  const bullets = generatedBullets.length > 0
    ? generatedBullets
    : productBullets.length > 0
      ? productBullets
      : auditBullets;

  const generatedTags = audit?.generatedContent?.keywords?.filter(Boolean) ?? [];
  const auditTags = audit?.targetKeywords?.filter(Boolean) ?? [];
  const productTags = product.targetKeywords?.filter(Boolean) ?? [];
  const tags = generatedTags.length > 0
    ? generatedTags
    : productTags.length > 0
      ? productTags
      : auditTags;

  const title = audit?.generatedContent?.title?.trim()
    || product.listingTitle?.trim()
    || product.title?.trim()
    || audit?.title?.trim()
    || product.name;
  const description = audit?.generatedContent?.htmlDescription?.trim()
    || product.descriptionHtml?.trim()
    || bulletsToTextarea(bullets);

  return {
    productName: product.name,
    sku: product.sku,
    brandName: product.brandName ?? audit?.brandName ?? "",
    category: product.category ?? audit?.category ?? "",
    assignedManager: product.manager?.name ?? "",
    priority: product.priorityLevel ?? "medium",
    notes: product.notes ?? "",
    listingTitle: title,
    bulletPointsText: bulletsToTextarea(bullets),
    tagsText: tagsToTextarea(tags),
    descriptionHtml: description,
    price: normalizePriceField(formatListingPrice(product.listingPrice, product.listingCurrency)),
  };
}

function EditDetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  return `${basePath}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="text-xs text-slate-900">{children}</div>
    </div>
  );
}

function CompactSummaryField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className={cn("text-[11px] font-medium text-slate-900 mt-0.5", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function CompactStatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-center">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums mt-0.5",
          accent === "emerald" ? "text-emerald-600" : "text-slate-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LiveBadge({ label }: { label?: string | null }) {
  const text = label?.trim() || "Draft";
  const isLive = text.toLowerCase() === "live" || text.toLowerCase() === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
        isLive
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200",
      )}
    >
      {text}
    </span>
  );
}

function PriorityBadge({ label, level }: { label?: string | null; level?: string | null }) {
  const text = label?.trim() || "Medium";
  const lvl = level ?? "medium";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
        level === "high" && "bg-orange-50 text-orange-700 border-orange-200",
        lvl === "medium" && "bg-amber-50 text-amber-700 border-amber-200",
        lvl === "low" && "bg-slate-50 text-slate-500 border-slate-200",
      )}
    >
      {text}
    </span>
  );
}

function OptimizedContentPanel({
  generatedContent,
  isOptimizing,
  onOptimize,
  optimizeDisabled,
}: {
  generatedContent?: GeneratedContent | null;
  isOptimizing: boolean;
  onOptimize: () => void;
  optimizeDisabled?: boolean;
}) {
  const { toast } = useToast();
  const [descViewMode, setDescViewMode] = useState<"preview" | "code">("preview");
  const contentBullets = generatedContent?.bulletPoints?.filter(Boolean) ?? [];
  const keywords = generatedContent?.keywords?.filter(Boolean) ?? [];
  const htmlDescription = generatedContent?.htmlDescription?.trim() ?? "";

  function copyText(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    });
  }

  return (
    <div className="border-t border-slate-100 pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-orange-600" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
            Optimized Content
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={onOptimize}
          disabled={optimizeDisabled || isOptimizing}
        >
          {isOptimizing ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Optimizing…
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1 opacity-70" />
              {generatedContent?.title ? "Regenerate" : "Optimize Content"}
            </>
          )}
        </Button>
      </div>

      {isOptimizing && !generatedContent?.title ? (
        <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/40 px-4 py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto mb-2" />
          <p className="text-[11px] text-slate-600">Generating optimized listing copy…</p>
        </div>
      ) : generatedContent?.title ? (
        <div className="rounded-lg border border-orange-200/80 bg-white overflow-hidden shadow-sm">
          <div className="bg-orange-50 border-b border-orange-100 px-4 py-2.5 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <p className="text-[10px] font-semibold text-orange-900">Generated Content</p>
          </div>
          <div className="px-4 py-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Product Title</p>
                <button
                  type="button"
                  onClick={() => copyText(generatedContent.title, "Title")}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <p className="text-[11px] font-medium text-slate-900 leading-snug whitespace-pre-wrap break-words">
                {generatedContent.title}
              </p>
            </div>

            {contentBullets.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bullet Points</p>
                  <button
                    type="button"
                    onClick={() => copyText(contentBullets.join("\n"), "Bullet points")}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <ul className="space-y-2">
                  {contentBullets.map((bullet, index) => (
                    <li key={`${index}-${bullet.slice(0, 24)}`} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {keywords.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Keywords</p>
                  <button
                    type="button"
                    onClick={() => copyText(keywords.join(", "), "Keywords")}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[10px] font-medium border border-orange-100"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {htmlDescription && (
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Description</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(htmlDescription, "HTML description")}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                    <div className="flex items-center bg-slate-100 rounded-md p-0.5">
                      <button
                        type="button"
                        onClick={() => setDescViewMode("preview")}
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                          descViewMode === "preview"
                            ? "bg-white text-slate-700 shadow-sm"
                            : "text-slate-400 hover:text-slate-500",
                        )}
                      >
                        <Eye className="w-3 h-3" />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescViewMode("code")}
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                          descViewMode === "code"
                            ? "bg-white text-slate-700 shadow-sm"
                            : "text-slate-400 hover:text-slate-500",
                        )}
                      >
                        <Code2 className="w-3 h-3" />
                        Code
                      </button>
                    </div>
                  </div>
                </div>
                {descViewMode === "preview" ? (
                  <div
                    className="prose prose-sm max-w-none text-slate-800 border border-slate-200 rounded-md p-3 bg-slate-50/50"
                    dangerouslySetInnerHTML={{ __html: htmlDescription }}
                  />
                ) : (
                  <pre className="text-[10px] text-slate-100 leading-relaxed border border-slate-700 rounded-md p-3 bg-slate-900 overflow-x-auto whitespace-pre-wrap font-mono">
                    {htmlDescription}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          No optimized content yet. Click Optimize Content to generate listing copy (1 AI credit).
        </p>
      )}
    </div>
  );
}

function AuditResultsPanel({
  overallScore,
  result,
  isRunning,
  onRunAudit,
  runDisabled,
  failed,
}: {
  overallScore: number;
  result: AuditResult | null | undefined;
  isRunning: boolean;
  onRunAudit: () => void;
  runDisabled?: boolean;
  failed?: boolean;
}) {
  const scoreCategories = result
    ? [
        { icon: Type, title: "Title", ...result.titleScore },
        { icon: AlignLeft, title: "Bullet points", ...result.bulletScore },
        { icon: ImageLucide, title: "Images", ...result.imageScore },
        { icon: Tag, title: "Keywords", ...result.keywordScore },
      ]
    : [];

  return (
    <div className="border-t border-slate-100 pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ClipboardCheck className="w-3.5 h-3.5 text-orange-600" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
            Audit Results
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={onRunAudit}
          disabled={runDisabled || isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Running audit…
            </>
          ) : (
            <>
              <ClipboardCheck className="w-3 h-3 mr-1 opacity-70" />
              {result ? "Re-run audit" : "Run Audit"}
            </>
          )}
        </Button>
      </div>

      {failed && (
        <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-[11px] text-red-700">
          AI analysis failed. Check your OpenAI API key in Admin → AI Settings and try again.
        </div>
      )}

      {isRunning && !result ? (
        <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/40 px-4 py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto mb-2" />
          <p className="text-[11px] text-slate-600">Analyzing your listing…</p>
        </div>
      ) : result ? (
        <div className="rounded-lg border border-orange-200/80 bg-orange-50/40 overflow-hidden">
          <div className="max-h-[28rem] overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <ScoreRing score={overallScore || result.overallScore} size="md" showLabel={false} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  AI Summary
                </p>
                <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {result.summary}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {scoreCategories.map((category) => (
                <div
                  key={category.title}
                  className="flex items-center justify-between rounded-md border border-white/80 bg-white/70 px-2.5 py-2"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <category.icon className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-[10px] font-medium text-slate-600 truncate">
                      {category.title}
                    </span>
                  </div>
                  <ScoreBadge score={category.score} className="text-[10px] px-1.5 py-0" />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {scoreCategories.map((category) => (
                <div key={`${category.title}-details`} className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {category.title}
                  </p>
                  {category.issues.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-500" />
                        <span className="text-[10px] font-medium text-rose-600">Issues</span>
                      </div>
                      <ul className="space-y-1 pl-4 list-disc marker:text-rose-300">
                        {category.issues.map((issue) => (
                          <li key={issue} className="text-[11px] text-slate-700 leading-relaxed">
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {category.suggestions.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Lightbulb className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-medium text-amber-600">Suggestions</span>
                      </div>
                      <ul className="space-y-1">
                        {category.suggestions.map((suggestion) => (
                          <li
                            key={suggestion}
                            className="text-[11px] text-slate-700 leading-relaxed flex gap-1.5"
                          >
                            <CheckCircle2 className="w-3 h-3 text-orange-500 shrink-0 mt-0.5" />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          No audit results yet. Click Run Audit to score this listing and get recommendations.
        </p>
      )}
    </div>
  );
}

function isValidProductDetail(p: ProductDetailView | undefined | null): p is ProductDetailView {
  return Boolean(
    p?.id
    && p.name
    && p.statusLabel
    && p.stageLabel
    && p.priorityLabel
    && p.manager?.name,
  );
}

function formatOptimizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.toLowerCase().includes("spend limit") || raw.includes("403")) {
    return "OpenAI API usage limit reached. Check your OpenAI account billing or try again later.";
  }
  if (raw.includes("402") || raw.toLowerCase().includes("insufficient")) {
    return "You don't have enough AI credits. Go to Billing to purchase more.";
  }
  if (raw.toLowerCase().includes("api key") || raw.includes("401") || raw.includes("authentication")) {
    return "OpenAI API key is invalid or missing. Check AI Settings in the admin panel.";
  }
  return raw || "Something went wrong. Please try again.";
}

function resolveOptimizeAuditId(
  product: ProductDetailView | null,
  auditId: number | undefined,
  source: ProductSourceType | null,
): number | null {
  if (product?.statsAuditId) return product.statsAuditId;
  if (auditId) return auditId;
  const src = product?.sourceType ?? source;
  if (product && (src === "listing" || src === "audit" || src === null)) {
    return product.id;
  }
  return null;
}

export default function ProductDetailPage({ id }: { id: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { featureWorkspaceId, isAccountOwner, canEdit: wsCanEdit } = useWorkspace();
  const [location, navigate] = useLocation();
  const [imageFailed, setImageFailed] = useState(false);
  const [isEditingListing, setIsEditingListing] = useState(false);
  const [editForm, setEditForm] = useState<ProductEditForm | null>(null);
  const [selectedWorkflowStep, setSelectedWorkflowStep] = useState<ProductExplorerWorkflowStepId>(2);
  const [isSavingWorkflowStep, setIsSavingWorkflowStep] = useState(false);
  const workflowProductIdRef = useRef<number | null>(null);

  const source = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return parseProductSource(params.get("source"));
  }, [location, id]);

  const urlWorkflowIntent = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      forceOverview: params.get("step") === "overview",
      openListingEdit: params.get("edit") === "listing",
    };
  }, [location, id]);

  const listingEditFromUrlRef = useRef(false);

  const canEditProduct = (source === null || source === "listing" || source === "audit")
    && (isAccountOwner || wsCanEdit("audits") || wsCanEdit("build_brand"));

  const validId = !Number.isNaN(id) && id > 0;
  const queryEnabled = clerkLoaded && !!user && !!featureWorkspaceId && validId;

  const {
    data: apiProduct,
    isLoading: apiLoading,
    isError: apiError,
    error: apiErrorObj,
  } = useQuery({
    queryKey: ["product", id, featureWorkspaceId, source ?? "auto"],
    queryFn: () => fetchProductDetail(id, source),
    enabled: queryEnabled,
    retry: false,
    staleTime: 10_000,
  });

  const shouldFetchAudit = source === null || source === "listing" || source === "audit";

  const {
    data: auditData,
    isLoading: auditLoading,
    isError: auditError,
  } = useGetAudit(id, {
    query: {
      queryKey: getGetAuditQueryKey(id),
      enabled: queryEnabled && shouldFetchAudit,
      retry: 1,
    },
  });

  const product = useMemo((): ProductDetailView | null => {
    if (isValidProductDetail(apiProduct)) {
      return normalizeStoreImportProductDetail(apiProduct, auditData);
    }
    if (apiLoading || apiError) return null;
    if (auditData && shouldFetchAudit) {
      return normalizeStoreImportProductDetail(
        mapAuditToProductDetail(auditData, "Account Owner", {
          sourceType: source === "audit" ? "audit" : "listing",
        }),
        auditData,
      );
    }
    return null;
  }, [apiProduct, apiLoading, apiError, auditData, shouldFetchAudit, source]);

  const optimizeAuditId = useMemo(
    () => resolveOptimizeAuditId(product, auditData?.id, source),
    [product, auditData?.id, source],
  );

  const shouldFetchLinkedAudit = queryEnabled
    && optimizeAuditId != null
    && optimizeAuditId !== id;

  const { data: linkedAuditData } = useGetAudit(optimizeAuditId ?? 0, {
    query: {
      queryKey: getGetAuditQueryKey(optimizeAuditId ?? 0),
      enabled: shouldFetchLinkedAudit,
      retry: 1,
    },
  });

  const effectiveAudit = useMemo(() => {
    if (!optimizeAuditId) return auditData;
    if (auditData?.id === optimizeAuditId) return auditData;
    return linkedAuditData ?? auditData;
  }, [auditData, linkedAuditData, optimizeAuditId]);

  const generateContent = useGenerateContent();

  const resolvedSource = product?.sourceType ?? source ?? "listing";

  const { data: marketplaceData } = useQuery({
    queryKey: ["product-marketplaces", id, resolvedSource],
    queryFn: () => fetchJson<{
      liveMarketplaces?: string[];
      listedMarketplaces?: string[];
      activeCount: number;
      listings?: Array<{
        marketplace: string;
        price: number | null;
        currency: string;
        sku: string | null;
      }>;
    }>(`${basePath}/api/products/${id}/marketplaces?source=${encodeURIComponent(resolvedSource)}`),
    enabled: queryEnabled && id > 0,
    staleTime: 15_000,
  });

  const liveMarketplaces = marketplaceData?.liveMarketplaces ?? [];

  const listingProduct = useMemo((): ProductDetailView | null => {
    if (!product) return null;

    const shopifyListing = marketplaceData?.listings?.find((listing) => listing.marketplace === "Shopify");
    const auditBullets = normalizeStringList(effectiveAudit?.bulletPoints);
    const generatedBullets = normalizeStringList(effectiveAudit?.generatedContent?.bulletPoints);
    const auditTags = normalizeStringList(effectiveAudit?.targetKeywords);
    const generatedTags = normalizeStringList(effectiveAudit?.generatedContent?.keywords);
    const productBullets = normalizeStringList(product.bulletPoints);
    const productTags = normalizeStringList(product.targetKeywords);

    const listingPrice = resolvePositivePrice(product.listingPrice, shopifyListing?.price);
    const listingCurrency = product.listingCurrency ?? shopifyListing?.currency ?? null;

    return {
      ...product,
      sku: product.sku || shopifyListing?.sku || product.sku,
      listingTitle: product.listingTitle?.trim()
        || product.title?.trim()
        || effectiveAudit?.title?.trim()
        || product.name,
      bulletPoints: productBullets.length > 0
        ? productBullets
        : auditBullets.length > 0
          ? auditBullets
          : generatedBullets,
      targetKeywords: productTags.length > 0
        ? productTags
        : auditTags.length > 0
          ? auditTags
          : generatedTags,
      descriptionHtml: product.descriptionHtml?.trim()
        || effectiveAudit?.generatedContent?.htmlDescription?.trim()
        || "",
      listingPrice,
      listingCurrency,
    };
  }, [product, marketplaceData, effectiveAudit]);

  async function refreshProductData() {
    const auditId = optimizeAuditId ?? product?.statsAuditId ?? id;
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["product", id, featureWorkspaceId, source ?? "auto"] }),
      queryClient.refetchQueries({ queryKey: getGetAuditQueryKey(auditId) }),
      queryClient.refetchQueries({ queryKey: getGetAuditQueryKey(id) }),
      queryClient.refetchQueries({ queryKey: ["product-marketplaces", id, resolvedSource] }),
    ]);
  }

  useEffect(() => {
    if (!isEditingListing || !editForm) return;
    writeListingDraft(id, editForm);
  }, [id, isEditingListing, editForm]);

  useEffect(() => {
    if (!product?.sourceType) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === product.sourceType) return;
    const preserved = new URLSearchParams();
    preserved.set("source", product.sourceType);
    const step = params.get("step");
    const edit = params.get("edit");
    if (step) preserved.set("step", step);
    if (edit) preserved.set("edit", edit);
    navigate(`/products/${id}?${preserved.toString()}`, { replace: true });
  }, [product?.sourceType, id, navigate]);

  const isLoading = queryEnabled && apiLoading && !product && !(shouldFetchAudit && auditLoading);

  const { data: shopifyStatus } = useQuery({
    queryKey: ["shopify-status"],
    queryFn: fetchShopifyStatus,
    enabled: Boolean(product?.isShopifyImport),
    staleTime: 60_000,
  });

  const { data: woocommerceStatus } = useQuery({
    queryKey: ["woocommerce-status"],
    queryFn: fetchWooCommerceStatus,
    enabled: Boolean(product?.isWooCommerceImport),
    staleTime: 60_000,
  });

  const canPublishToAmazon = Boolean(product && !isStoreImportProduct(product) && canEditProduct);
  const { data: amazonStatus } = useQuery({
    queryKey: ["amazon-status"],
    queryFn: fetchAmazonStatus,
    enabled: canPublishToAmazon,
    staleTime: 60_000,
  });

  const publishShopifyMutation = useMutation({
    mutationFn: async (publishMode: "draft" | "live") => {
      const auditId = optimizeAuditId ?? product?.statsAuditId ?? id;
      return publishAuditToShopify({ auditId, publishMode });
    },
    onSuccess: (result, publishMode) => {
      void queryClient.invalidateQueries({ queryKey: ["product", id, featureWorkspaceId, source ?? "auto"] });
      void queryClient.invalidateQueries({ queryKey: ["product-marketplaces", id] });
      if (result.warning) {
        toast({
          title: "Published with a warning",
          description: result.warning,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: publishMode === "live" ? "Published to Shopify" : "Saved to Shopify draft",
        description: publishMode === "live"
          ? result.listingUrl
            ? "Your listing is live on your Shopify Online Store."
            : result.message
          : result.message,
      });
    },
    onError: (error) => {
      const description = error instanceof ApiFetchError && error.status === 401
        ? "Your session expired or the server could not verify your login. Sign in again and retry."
        : error instanceof Error
          ? error.message
          : "Could not publish to Shopify.";
      toast({
        title: "Publish failed",
        description,
        variant: "destructive",
      });
    },
  });

  const publishWooCommerceMutation = useMutation({
    mutationFn: async (publishMode: "draft" | "live") => {
      const auditId = optimizeAuditId ?? product?.statsAuditId ?? id;
      return publishAuditToWooCommerce({ auditId, publishMode });
    },
    onSuccess: (result, publishMode) => {
      void queryClient.invalidateQueries({ queryKey: ["product", id, featureWorkspaceId, source ?? "auto"] });
      void queryClient.invalidateQueries({ queryKey: ["product-marketplaces", id] });
      if (result.warning) {
        toast({
          title: "Published with a warning",
          description: result.warning,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: publishMode === "live" ? "Published to WooCommerce" : "Saved to WooCommerce draft",
        description: publishMode === "live"
          ? result.listingUrl
            ? "Your listing is live on your WooCommerce store."
            : result.message
          : result.message,
      });
    },
    onError: (error) => {
      const description = error instanceof ApiFetchError && error.status === 401
        ? "Your session expired or the server could not verify your login. Sign in again and retry."
        : error instanceof Error
          ? error.message
          : "Could not publish to WooCommerce.";
      toast({
        title: "Publish failed",
        description,
        variant: "destructive",
      });
    },
  });

  const publishAmazonMutation = useMutation({
    mutationFn: async () => {
      const auditId = optimizeAuditId ?? product?.statsAuditId ?? id;
      return publishAuditToAmazon({
        auditId,
        marketplace: amazonStatus?.defaultMarketplace,
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["product", id, featureWorkspaceId, source ?? "auto"] });
      void queryClient.invalidateQueries({ queryKey: ["product-marketplaces", id] });
      if (result.warning) {
        toast({
          title: "Published with a warning",
          description: result.warning,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: result.sandbox ? "Published to Amazon sandbox" : "Published to Amazon",
        description: result.listingUrl
          ? `Listing submitted${result.sku ? ` (SKU: ${result.sku})` : ""}.`
          : result.message,
      });
    },
    onError: (error) => {
      const description = error instanceof ApiFetchError && error.status === 401
        ? "Your session expired or the server could not verify your login. Sign in again and retry."
        : error instanceof Error
          ? error.message
          : "Could not publish to Amazon.";
      toast({
        title: "Publish failed",
        description,
        variant: "destructive",
      });
    },
  });

  const saveProductMutation = useMutation({
    mutationFn: async (data: ProductEditForm) => {
      const auditId = optimizeAuditId ?? product?.statsAuditId ?? id;
      const payload: Record<string, unknown> = {
        productName: data.productName.trim(),
        brandName: data.brandName.trim(),
        category: data.category.trim(),
        sku: data.sku.trim(),
        priority: data.priority,
        assignedManager: data.assignedManager.trim(),
        notes: data.notes.trim(),
      };

      const isStoreListing = isStoreImportProduct(product) || Boolean(data.listingTitle.trim());
      const parsedPrice = parsePriceInput(data.price);

      if (isStoreListing) {
        const title = data.listingTitle.trim() || data.productName.trim();
        if (!title) {
          throw new Error("Listing title is required");
        }
        payload.productName = title;
        payload.listingTitle = title;
        payload.bulletPoints = parseBulletTextarea(data.bulletPointsText);
        payload.targetKeywords = parseTagsTextarea(data.tagsText);
        payload.descriptionHtml = data.descriptionHtml.trim();
        payload.sku = data.sku.trim();
        if (parsedPrice != null) {
          payload.price = String(parsedPrice);
        }
      }

      let response: unknown;
      try {
        response = await fetchJson(`${basePath}/api/audits/${auditId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        if (error instanceof ApiFetchError && error.status === 404) {
          response = await fetchJson(`${basePath}/api/products/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          throw error;
        }
      }

      return { marketplaceSync: extractMarketplaceSync(response) };
    },
    onSuccess: async (result) => {
      clearListingDraft(id);
      await refreshProductData();
      void queryClient.invalidateQueries({ queryKey: ["product-marketplaces", id, resolvedSource] });
      setIsEditingListing(false);
      setEditForm(null);

      const { syncedPlatforms, warnings, errors } = describeMarketplaceSyncResult(result?.marketplaceSync);

      if (syncedPlatforms.length > 0) {
        const syncedDescription = syncedPlatforms.length === 1
          ? `${syncedPlatforms[0]} listing updated with your latest title, price, description, and tags.`
          : `${syncedPlatforms.join(", ")} listings updated with your latest title, price, description, and tags.`;
        if (errors.length > 0) {
          toast({
            title: "Saved with partial marketplace sync",
            description: `${syncedDescription} ${errors.join(" ")}`,
            variant: "destructive",
          });
          return;
        }
        if (warnings.length > 0) {
          toast({
            title: "Saved & synced with a warning",
            description: `${syncedDescription} ${warnings.join(" ")}`,
            variant: "destructive",
          });
          return;
        }
        toast({
          title: syncedPlatforms.length === 1
            ? `Saved & synced to ${syncedPlatforms[0]}`
            : `Saved & synced to ${syncedPlatforms.join(", ")}`,
          description: syncedDescription,
        });
        return;
      }

      if (errors.length > 0) {
        toast({
          title: "Saved locally — marketplace sync failed",
          description: errors.join(" "),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Saved",
        description: isStoreImportProduct(product)
          ? "Changes saved. Connect Shopify, WooCommerce, or Amazon on Marketplaces to sync listing updates."
          : "Product details updated.",
      });
    },
    onError: (error) => {
      const description =
        error instanceof ApiFetchError
          ? error.message
          : "Could not save product details.";
      toast({
        title: "Failed",
        description,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!product?.id) return;
    if (workflowProductIdRef.current === product.id) return;
    workflowProductIdRef.current = product.id;
    if (urlWorkflowIntent.forceOverview) {
      setSelectedWorkflowStep(2);
      return;
    }
    if (product.currentStep) {
      setSelectedWorkflowStep(apiStepToProductExplorerStep(product.currentStep));
    }
  }, [product?.id, product?.currentStep, urlWorkflowIntent.forceOverview]);

  useEffect(() => {
    listingEditFromUrlRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!urlWorkflowIntent.forceOverview || !urlWorkflowIntent.openListingEdit) return;
    if (!listingProduct || !canEditProduct || listingEditFromUrlRef.current) return;
    listingEditFromUrlRef.current = true;
    setSelectedWorkflowStep(2);
    const baseForm = buildListingEditForm(listingProduct, effectiveAudit);
    const savedDraft = readListingDraft(id);
    setEditForm(mergeListingEditForm(baseForm, savedDraft));
    setIsEditingListing(true);
  }, [
    urlWorkflowIntent.forceOverview,
    urlWorkflowIntent.openListingEdit,
    listingProduct,
    effectiveAudit,
    canEditProduct,
    id,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-9 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-80 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!product) {
    const apiMissing = apiErrorObj instanceof ApiFetchError && apiErrorObj.status === 404;
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Package className="w-10 h-10 text-slate-300 mb-3" />
        <h2 className="text-base font-semibold text-slate-900">Product not found</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-md">
          {auditError
            ? "This product may have been removed or you may not have access to it in the current workspace."
            : apiMissing
              ? "This product could not be loaded. It may have been removed, or the project type may not match this URL. Try opening it again from Product Explorer."
              : "This product may have been removed or you may not have access to it in the current workspace."}
        </p>
        <div className="flex gap-2 mt-5">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link href="/products">Back to Product Explorer</Link>
          </Button>
          {validId && (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs bg-orange-500 hover:bg-orange-600"
              onClick={() => navigate(`/audits/workflow?resume=${id}`)}
            >
              Open in Workflow
            </Button>
          )}
        </div>
      </div>
    );
  }

  const imageSrc = product.imageUrl && !imageFailed ? resolveImageUrl(product.imageUrl) : null;
  const createdDate = product.createdAt ? format(new Date(product.createdAt), "MMM d, yyyy") : "—";
  const listingRating = product.stats.listingScore > 0
    ? (product.stats.listingScore / 20).toFixed(1)
    : "—";

  function openListingEditor() {
    if (!canEditProduct || !listingProduct) return;
    setSelectedWorkflowStep(2);
    const baseForm = buildListingEditForm(listingProduct, effectiveAudit);
    const savedDraft = readListingDraft(id);
    setEditForm(mergeListingEditForm(baseForm, savedDraft));
    setIsEditingListing(true);
  }

  function cancelListingEditor() {
    setIsEditingListing(false);
    setEditForm(null);
  }

  function saveListingEditor() {
    if (!validateListingEditor() || !editForm) return;
    saveProductMutation.mutate(editForm);
  }

  function validateListingEditor(): boolean {
    if (!editForm) return false;
    if (isStoreImportProduct(product)) {
      if (!editForm.listingTitle.trim() || !editForm.sku.trim()) {
        toast({
          title: "Missing fields",
          description: "Title and SKU are required.",
          variant: "destructive",
        });
        return false;
      }
      const publishReady = product?.isShopifyImport
        ? shopifyStatus?.publishReady
        : product?.isWooCommerceImport
          ? woocommerceStatus?.publishReady
          : false;
      if (publishReady) {
        const price = parsePriceInput(editForm.price);
        if (price == null || price <= 0) {
          toast({
            title: "Price required",
            description: "Enter a valid price — it will sync to your store when you save.",
            variant: "destructive",
          });
          return false;
        }
      }
      return true;
    }
    if (!editForm.productName.trim() || !editForm.sku.trim()) {
      toast({
        title: "Missing fields",
        description: "Product name and SKU are required.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  function handleSaveAndContinueToGraphics() {
    if (!validateListingEditor() || !editForm) return;
    const auditId = optimizeAuditId ?? product?.statsAuditId ?? id;

    saveProductMutation.mutate(editForm, {
      onSuccess: async () => {
        await goToGraphicsStep(auditId);
      },
    });
  }

  async function goToGraphicsStep(auditId: number) {
    await saveAndContinueWorkflowStep(3, auditId);
  }

  function goToWorkflowStep(stepId: ProductExplorerWorkflowStepId) {
    setSelectedWorkflowStep(stepId);
  }

  async function persistWorkflowApiStep(apiStep: number, auditIdOverride?: number) {
    const auditId = auditIdOverride ?? optimizeAuditId ?? product?.statsAuditId ?? id;
    if (!auditId) return;
    await fetchJson(`${basePath}/api/audits/${auditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStep: apiStep }),
    });
    void queryClient.invalidateQueries({ queryKey: ["product", id, featureWorkspaceId, source ?? "auto"] });
    void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
  }

  async function saveAndContinueWorkflowStep(
    fromStep: ProductExplorerWorkflowStepId = selectedWorkflowStep,
    auditIdOverride?: number,
  ) {
    const nextStep = nextProductExplorerWorkflowStep(fromStep);
    if (!nextStep) return;

    setIsSavingWorkflowStep(true);
    setSelectedWorkflowStep(nextStep);

    const apiStep = productExplorerSaveContinueApiStep(fromStep);
    if (apiStep != null) {
      try {
        await persistWorkflowApiStep(apiStep, auditIdOverride);
      } catch {
        // Step navigation still works if persistence fails.
      }
    }

    setIsSavingWorkflowStep(false);
  }

  function resolvePendingListingForm(): ProductEditForm | null {
    if (isEditingListing && editForm) return editForm;
    const draft = readListingDraft(id);
    if (!draft) return null;
    if (!listingProduct) return draft;
    return mergeListingEditForm(buildListingEditForm(listingProduct, effectiveAudit), draft);
  }

  function publishAfterSave(form?: ProductEditForm | null) {
    if (form) {
      saveProductMutation.mutate(form, {
        onSuccess: () => {
          if (product?.isWooCommerceImport) {
            publishWooCommerceMutation.mutate("live");
          } else {
            publishShopifyMutation.mutate("live");
          }
        },
      });
      return;
    }
    if (product?.isWooCommerceImport) {
      publishWooCommerceMutation.mutate("live");
      return;
    }
    publishShopifyMutation.mutate("live");
  }

  function handlePublishToStore() {
    if (!isStoreImportProduct(product)) return;
    if (!canEditProduct) return;

    const isWoo = Boolean(product?.isWooCommerceImport);
    const status = isWoo ? woocommerceStatus : shopifyStatus;
    const platformLabel = isWoo ? "WooCommerce" : "Shopify";

    if (!status?.connected) {
      toast({
        title: `${platformLabel} not connected`,
        description: `Connect your ${platformLabel} store on the Marketplaces page before publishing.`,
        variant: "destructive",
        action: (
          <Button asChild variant="outline" size="sm" className="h-7 text-[11px]">
            <Link href="/marketplaces">Go to Marketplaces</Link>
          </Button>
        ),
      });
      return;
    }

    if (!status.publishReady) {
      toast({
        title: `${platformLabel} credentials required`,
        description: isWoo
          ? "Add your WooCommerce Consumer key and Consumer secret on the Marketplaces page to enable direct publishing."
          : "Add your Shopify Client ID and Client secret on the Marketplaces page to enable direct publishing.",
        variant: "destructive",
        action: (
          <Button asChild variant="outline" size="sm" className="h-7 text-[11px]">
            <Link href="/marketplaces">Go to Marketplaces</Link>
          </Button>
        ),
      });
      return;
    }

    const pendingForm = resolvePendingListingForm();
    const savedPrice = listingProduct?.listingPrice;
    const pendingPrice = parsePriceInput(pendingForm?.price);
    const hasSavedPrice = savedPrice != null && savedPrice > 0;
    const hasPendingPrice = pendingPrice != null && pendingPrice > 0;

    if (pendingForm && hasPendingPrice) {
      publishAfterSave(pendingForm);
      return;
    }

    if (!hasSavedPrice) {
      toast({
        title: "Price required",
        description: `Enter a price in Edit Listing, then click Save & sync to ${platformLabel}.`,
        variant: "destructive",
      });
      openListingEditor();
      return;
    }

    publishAfterSave();
  }

  function handlePublishToShopify() {
    handlePublishToStore();
  }

  function handlePublishToAmazon() {
    if (!canPublishToAmazon) return;

    if (!amazonStatus?.connected) {
      toast({
        title: "Amazon not connected",
        description: "Connect your Amazon seller account on the Marketplaces page before publishing.",
        variant: "destructive",
        action: (
          <Button asChild variant="outline" size="sm" className="h-7 text-[11px]">
            <Link href="/marketplaces">Go to Marketplaces</Link>
          </Button>
        ),
      });
      return;
    }

    if (!amazonStatus.publishReady) {
      toast({
        title: "Amazon publishing unavailable",
        description: "Amazon publishing isn't set up yet. Contact your administrator.",
        variant: "destructive",
      });
      return;
    }

    const hasTitle = Boolean(
      listingProduct?.listingTitle?.trim()
        || effectiveAudit?.title?.trim()
        || effectiveAudit?.generatedContent?.title?.trim()
        || product?.name?.trim(),
    );
    if (!hasTitle) {
      toast({
        title: "Listing content required",
        description: "Add a product title or generate listing content before publishing to Amazon.",
        variant: "destructive",
      });
      return;
    }

    const pendingForm = resolvePendingListingForm();
    if (pendingForm) {
      saveProductMutation.mutate(pendingForm, {
        onSuccess: () => {
          publishAmazonMutation.mutate();
        },
      });
      return;
    }

    publishAmazonMutation.mutate();
  }

  const graphicsAuditId = optimizeAuditId ?? product?.statsAuditId ?? id;
  const showBuildBrandWorkflow = resolvedSource === "listing" || resolvedSource === "audit";
  const workflowStepCompleted = productExplorerStepCompletedFromCurrentStep(
    product?.currentStep,
    product?.status,
  );

  const canPublishToStore = Boolean(isStoreImportProduct(product) && canEditProduct);
  const isPublishingToStore = publishShopifyMutation.isPending || publishWooCommerceMutation.isPending;
  const isPublishingToAmazon = publishAmazonMutation.isPending;
  const storePublishReady = product?.isWooCommerceImport
    ? woocommerceStatus?.publishReady
    : product?.isShopifyImport
      ? shopifyStatus?.publishReady
      : false;
  const storePlatformLabel = product?.isWooCommerceImport ? "WooCommerce" : "Shopify";

  function updateEditField<K extends keyof ProductEditForm>(key: K, value: ProductEditForm[K]) {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const canOptimizeContent = canEditProduct && optimizeAuditId != null;
  const isOptimizingContent = generateContent.isPending;

  function handleOptimizeContent() {
    if (!optimizeAuditId) {
      toast({
        title: "Cannot optimize",
        description: "This product has no linked listing audit.",
        variant: "destructive",
      });
      return;
    }
    if (!canEditProduct) return;

    generateContent.mutate(
      { id: optimizeAuditId },
      {
        onSuccess: (generatedContent) => {
          queryClient.setQueryData(
            getGetAuditQueryKey(optimizeAuditId),
            (current) => (current
              ? {
                  ...current,
                  generatedContent,
                  title: generatedContent.title?.trim() || current.title,
                  bulletPoints: generatedContent.bulletPoints?.length
                    ? generatedContent.bulletPoints
                    : current.bulletPoints,
                  targetKeywords: generatedContent.keywords?.length
                    ? generatedContent.keywords
                    : current.targetKeywords,
                }
              : current),
          );
          if (optimizeAuditId !== id) {
            queryClient.setQueryData(
              getGetAuditQueryKey(id),
              (current) => (current
                ? {
                    ...current,
                    generatedContent,
                    title: generatedContent.title?.trim() || current.title,
                    bulletPoints: generatedContent.bulletPoints?.length
                      ? generatedContent.bulletPoints
                      : current.bulletPoints,
                    targetKeywords: generatedContent.keywords?.length
                      ? generatedContent.keywords
                      : current.targetKeywords,
                  }
                : current),
            );
          }
          void queryClient.invalidateQueries({ queryKey: ["product", id, featureWorkspaceId, source ?? "auto"] });
          void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(optimizeAuditId) });
          refreshCreditBalances(queryClient);
          toast({
            title: "Listing content regenerated",
            description: "Your optimized content is ready. 1 AI credit was used.",
          });
        },
        onError: (err) => {
          toast({
            title: "Optimize failed",
            description: formatOptimizeError(err),
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-300 pb-8">
      <ProductDetailRibbon productId={product.id} productName={product.name} />

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-lg border border-slate-100 bg-amber-50 flex items-center justify-center overflow-hidden shrink-0">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <Package className="w-5 h-5 text-amber-600/70" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900 truncate">
                  {product.isShopifyImport || product.isWooCommerceImport
                    ? (listingProduct?.listingTitle ?? listingProduct?.title ?? product.name)
                    : product.name}
                </h1>
                <LiveBadge label={product.statusLabel} />
                <PriorityBadge label={product.priorityLabel} level={product.priorityLevel} />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                <span className="font-medium text-slate-600">SKU:</span> {product.sku}
                <span className="mx-1.5 text-slate-300">|</span>
                <span className="font-medium text-slate-600">Brand:</span> {product.brandName || "—"}
                <span className="mx-1.5 text-slate-300">|</span>
                <span className="font-medium text-slate-600">Category:</span> {product.category || "—"}
                <span className="mx-1.5 text-slate-300">|</span>
                <span className="font-medium text-slate-600">Manager:</span> {product.manager?.name ?? "—"}
              </p>
              {liveMarketplaces.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Listed on
                  </span>
                  {liveMarketplaces.map((marketplace) => (
                    <button
                      key={marketplace}
                      type="button"
                      onClick={() => goToWorkflowStep(6)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/60 px-2 py-1 hover:bg-emerald-50 transition-colors"
                      title={`View ${marketplace} listing`}
                    >
                      <MarketplaceLogo marketplace={marketplace} className="h-3.5 w-16" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="sm:w-44 shrink-0 sm:text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-1">
              Overall Progress
            </p>
            <p className="text-xl font-semibold text-slate-900 tabular-nums">{product.progressPercent}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all"
                style={{ width: `${product.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {showBuildBrandWorkflow && (
        <ProductExplorerWorkflowStepper
          activeStep={selectedWorkflowStep}
          stepCompleted={workflowStepCompleted}
          onStepClick={goToWorkflowStep}
        />
      )}

      {showBuildBrandWorkflow && graphicsAuditId > 0 && (
        <ProductWorkflowStepContent
          step={selectedWorkflowStep}
          auditId={graphicsAuditId}
          productName={product.name}
          audit={effectiveAudit}
          generatedContent={effectiveAudit?.generatedContent ?? null}
          isOptimizing={isOptimizingContent}
          onOptimize={handleOptimizeContent}
          optimizeDisabled={!canOptimizeContent}
          productId={product.id}
          productSource={resolvedSource}
          canPublishMarketplaces={canEditProduct}
          onSaveAndContinue={() => void saveAndContinueWorkflowStep()}
          isSavingContinue={isSavingWorkflowStep}
          OptimizedContentPanel={OptimizedContentPanel}
          overviewContent={
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-slate-900">Overview</h2>
                {canEditProduct && !isEditingListing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={openListingEditor}
                  >
                    <Pencil className="w-3 h-3 mr-1 opacity-70" />
                    Edit listing
                  </Button>
                )}
              </div>
              {isStoreImportProduct(product) ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <CompactSummaryField label="SKU" value={listingProduct?.sku ?? product.sku} mono />
                  <CompactSummaryField label="Brand" value={product.brandName || "—"} />
                  <CompactSummaryField label="Category" value={product.category || "—"} />
                  <CompactSummaryField
                    label="Price"
                    value={
                      listingProduct?.listingPrice != null && listingProduct.listingPrice > 0
                        ? `${listingProduct.listingCurrency ?? ""} ${listingProduct.listingPrice.toFixed(2)}`.trim()
                        : "—"
                    }
                  />
                  <div className="col-span-2 sm:col-span-4">
                    <CompactSummaryField label="Stage" value={<LiveBadge label={product.stageLabel} />} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <CompactSummaryField label="SKU" value={product.sku} mono />
                  <CompactSummaryField label="Brand" value={product.brandName || "—"} />
                  <CompactSummaryField label="Category" value={product.category || "—"} />
                  <CompactSummaryField label="Manager" value={product.manager?.name ?? "—"} />
                  <CompactSummaryField label="Stage" value={<LiveBadge label={product.stageLabel} />} />
                  <CompactSummaryField
                    label="Priority"
                    value={
                      <PriorityBadge
                        label={(product.priorityLabel ?? "Medium Priority").replace(" Priority", "")}
                        level={product.priorityLevel}
                      />
                    }
                  />
                  <CompactSummaryField
                    label="Listing Score"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {listingRating}
                        {product.stats.listingScore > 0 && (
                          <span className="text-slate-400 font-normal">/ 5</span>
                        )}
                      </span>
                    }
                  />
                  <CompactSummaryField label="Created" value={createdDate} />
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-slate-100 pt-3">
                <CompactStatChip label="Orders" value={String(product.stats.totalOrders)} />
                <CompactStatChip
                  label="Revenue"
                  value={
                    product.stats.revenue != null
                      ? product.stats.revenueCurrency === "INR"
                        ? `₹${product.stats.revenue.toLocaleString("en-IN")}`
                        : `$${product.stats.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "—"
                  }
                  accent="emerald"
                />
                <CompactStatChip
                  label="Marketplaces"
                  value={liveMarketplaces.length > 0 ? String(liveMarketplaces.length) : String(product.stats.marketplacesActive)}
                />
                <CompactStatChip label="Images" value={String(product.stats.imageCount)} />
              </div>
            </div>
          }
          listingEditorContent={
            isEditingListing && editForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-slate-900">Edit listing</h2>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={cancelListingEditor}
                      disabled={saveProductMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-[11px] bg-orange-500 hover:bg-orange-600"
                      onClick={saveListingEditor}
                      disabled={saveProductMutation.isPending}
                    >
                      {saveProductMutation.isPending ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {storePublishReady ? "Syncing…" : "Saving…"}
                        </>
                      ) : (
                        storePublishReady
                          ? `Save & sync to ${storePlatformLabel}`
                          : "Save changes"
                      )}
                    </Button>
                  </div>
                </div>
                {product.isShopifyImport || product.isWooCommerceImport ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="sm:col-span-2">
                      <EditDetailField label="Title">
                        <Input
                          value={editForm.listingTitle}
                          onChange={(e) => updateEditField("listingTitle", e.target.value)}
                          className="text-[11px]"
                          placeholder={`Product title on your ${storePlatformLabel} store`}
                        />
                      </EditDetailField>
                    </div>
                    <EditDetailField label="SKU">
                      <Input
                        value={editForm.sku}
                        onChange={(e) => updateEditField("sku", e.target.value)}
                        className="text-[11px] font-mono"
                      />
                    </EditDetailField>
                    <EditDetailField label="Price">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editForm.price}
                          onChange={(e) => updateEditField("price", e.target.value)}
                          onBlur={(e) => updateEditField("price", normalizePriceField(e.target.value))}
                          className="text-[11px] font-mono"
                          placeholder="Enter price"
                          inputMode="decimal"
                        />
                        {product.listingCurrency && (
                          <span className="text-[10px] text-slate-500 shrink-0">{product.listingCurrency}</span>
                        )}
                      </div>
                    </EditDetailField>
                    <EditDetailField label="Brand">
                      <Input
                        value={editForm.brandName}
                        onChange={(e) => updateEditField("brandName", e.target.value)}
                        className="text-[11px]"
                        placeholder="Vendor"
                      />
                    </EditDetailField>
                    <EditDetailField label="Category">
                      <Input
                        value={editForm.category}
                        onChange={(e) => updateEditField("category", e.target.value)}
                        className="text-[11px]"
                        placeholder="Product type"
                      />
                    </EditDetailField>
                    <div className="sm:col-span-2">
                      <EditDetailField label="Tags">
                        <Input
                          value={editForm.tagsText}
                          onChange={(e) => updateEditField("tagsText", e.target.value)}
                          className="text-[11px]"
                          placeholder="comma, separated, tags"
                        />
                      </EditDetailField>
                    </div>
                    <div className="sm:col-span-2">
                      <EditDetailField label="Bullet points">
                        <Textarea
                          value={editForm.bulletPointsText}
                          onChange={(e) => updateEditField("bulletPointsText", e.target.value)}
                          className="text-[11px] min-h-[96px] font-mono"
                          placeholder="One bullet per line"
                        />
                      </EditDetailField>
                    </div>
                    <div className="sm:col-span-2">
                      <EditDetailField label="Description (HTML)">
                        <Textarea
                          value={editForm.descriptionHtml}
                          onChange={(e) => updateEditField("descriptionHtml", e.target.value)}
                          className="text-[11px] min-h-[120px] font-mono"
                          placeholder="Product description for Shopify"
                        />
                      </EditDetailField>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <EditDetailField label="Product Name">
                      <Input
                        value={editForm.productName}
                        onChange={(e) => updateEditField("productName", e.target.value)}
                        className="text-[11px]"
                      />
                    </EditDetailField>
                    <EditDetailField label="SKU">
                      <Input
                        value={editForm.sku}
                        onChange={(e) => updateEditField("sku", e.target.value)}
                        className="text-[11px] font-mono"
                      />
                    </EditDetailField>
                    <EditDetailField label="Brand">
                      <Input
                        value={editForm.brandName}
                        onChange={(e) => updateEditField("brandName", e.target.value)}
                        className="text-[11px]"
                      />
                    </EditDetailField>
                    <EditDetailField label="Category">
                      <Input
                        value={editForm.category}
                        onChange={(e) => updateEditField("category", e.target.value)}
                        className="text-[11px]"
                        placeholder="e.g. Watches"
                      />
                    </EditDetailField>
                    <EditDetailField label="Assigned Manager">
                      <Input
                        value={editForm.assignedManager}
                        onChange={(e) => updateEditField("assignedManager", e.target.value)}
                        className="text-[11px]"
                      />
                    </EditDetailField>
                    <EditDetailField label="Created Date">
                      <p className="text-xs text-slate-500 py-1.5">{createdDate}</p>
                    </EditDetailField>
                    <EditDetailField label="Priority">
                      <select
                        value={editForm.priority}
                        onChange={(e) =>
                          updateEditField(
                            "priority",
                            e.target.value as ProductEditForm["priority"],
                          )
                        }
                        className="flex h-8 w-full rounded-lg border border-input bg-transparent px-3 text-[11px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </EditDetailField>
                    <EditDetailField label="Current Stage">
                      <div className="py-1">
                        <LiveBadge label={product.stageLabel} />
                      </div>
                    </EditDetailField>
                    <div className="sm:col-span-2">
                      <EditDetailField label="Notes">
                        <Textarea
                          value={editForm.notes}
                          onChange={(e) => updateEditField("notes", e.target.value)}
                          className="text-[11px] min-h-[72px]"
                        />
                      </EditDetailField>
                    </div>
                  </div>
                )}
                {!isStoreImportProduct(product) && (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[11px] rounded-xl gap-1.5"
                      onClick={cancelListingEditor}
                      disabled={saveProductMutation.isPending}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-[11px] rounded-xl bg-orange-500 hover:bg-orange-600 gap-1.5"
                      onClick={handleSaveAndContinueToGraphics}
                      disabled={saveProductMutation.isPending}
                    >
                      {saveProductMutation.isPending ? (
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
            ) : undefined
          }
        />
      )}

      <button
        type="button"
        onClick={() => navigate("/products")}
        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Product Explorer
      </button>
    </div>
  );
}
