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
  FileText,
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
import { getAudit, useGenerateContent, type AuditWithResults, type GetAuditQueryResult } from "@workspace/api-client-react";

function productAuditQueryKey(auditId: number, scope: string) {
  return ["product-audit", auditId, scope] as const;
}
import type { AuditResult, GeneratedContent } from "@workspace/api-client-react";
import type { ReferenceResearchData } from "@/lib/reference-research";
import { formatAiErrorMessage } from "@/lib/ai-error-message";
import { normalizeStoreImportProductDetail } from "@/lib/store-import-product-detail";
import { isShopifyImportAsin } from "@/lib/shopify-import";
import { isWooCommerceImportAsin } from "@/lib/woocommerce-import";
import { fetchShopifyStatus } from "@/lib/shopify-publish";
import { ShopifyPublishCollectionsDialog } from "@/components/shopify-publish-collections-dialog";
import { fetchWooCommerceStatus, publishAuditToWooCommerce } from "@/lib/woocommerce-publish";
import { fetchAmazonStatus, publishAuditToAmazon } from "@/lib/amazon-publish";
import {
  pickDefaultMarketplaceId,
  useListingContentMarketplaces,
} from "@/lib/content-marketplaces";
import {
  ListingMarketplaceContentPanel,
  type ContentVariantRow,
} from "@/components/listing-marketplace-content-panel";
import { ScoreBadge, ScoreRing } from "@/components/score-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LISTING_CURRENCY_OPTIONS, normalizeListingCurrency } from "@/lib/listing-currencies";
import { ApiFetchError, fetchJson } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { isAgencyAccountOverviewDashboard } from "@/lib/agency-dashboard-scope";
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
  nextProductExplorerWorkflowStep,
  productExplorerSaveContinueApiStep,
  productExplorerStepCompletedFromData,
  resolveInitialProductExplorerStep,
  type ProductExplorerWorkflowStepId,
} from "@/components/product-explorer-workflow-stepper";
import { ProductWorkflowStepContent } from "@/components/product-workflow-step-content";
import {
  type ContentVariantWithMeta,
  variantToPreviewGeneratedContent,
} from "@/lib/listing-content-field-merge";
import type { ContentMarketplaceOption } from "@/lib/content-marketplaces";
import { ProductExplorerOverviewPreview } from "@/components/product-explorer-overview-preview";

type ProductSourceType = "listing" | "audit" | "graphics" | "video" | "ads";

function parseProductSource(raw: string | null): ProductSourceType | null {
  if (raw === "listing" || raw === "audit" || raw === "graphics" || raw === "video" || raw === "ads") {
    return raw;
  }
  return null;
}

type ProductApiScope = {
  accountOverview: boolean;
};

function productApiFetchInit(scope: ProductApiScope) {
  return scope.accountOverview ? { skipWorkspaceHeader: true } : undefined;
}

function productDetailQueryString(source: ProductSourceType | null, scope: ProductApiScope): string {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (scope.accountOverview) params.set("scope", "account");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function fetchAuditForProductDetail(
  id: number,
  accountOverview: boolean,
): Promise<AuditWithResults> {
  if (accountOverview) {
    return fetchJson<AuditWithResults>(
      `${basePath}/api/audits/${id}?scope=account`,
      { skipWorkspaceHeader: true },
    );
  }
  return getAudit(id);
}

async function fetchProductDetail(
  id: number,
  source: ProductSourceType | null,
  scope: ProductApiScope,
): Promise<ProductDetailView> {
  const sourceQuery = productDetailQueryString(source, scope);
  const fetchInit = productApiFetchInit(scope);
  try {
    return await fetchJson<ProductDetailView>(`${basePath}/api/products/${id}${sourceQuery}`, fetchInit);
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
    }>(`${basePath}/api/graphics/projects/${id}`, fetchInit);
    return mapGraphicsToProductDetail(graphics);
  }
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function isStoreImportProduct(product?: Pick<ProductDetailView, "isShopifyImport" | "isWooCommerceImport"> | null): boolean {
  return Boolean(product?.isShopifyImport || product?.isWooCommerceImport);
}

/** Show the left "Existing Content" column for store imports and Amazon audit listings only. */
function shouldShowExistingListingContent(
  product?: Pick<ProductDetailView, "isShopifyImport" | "isWooCommerceImport"> | null,
  audit?: { asin?: string | null } | null,
): boolean {
  if (isStoreImportProduct(product)) return true;
  const asin = audit?.asin?.trim();
  return Boolean(asin && !isShopifyImportAsin(asin) && !isWooCommerceImportAsin(asin));
}

/** Detect keywords that were tokenized from description/bullet text instead of real store tags. */
function looksLikeTokenizedDescriptionKeywords(
  keywords: string[],
  description: string,
): boolean {
  if (keywords.length < 6) return false;
  const haystack = description.toLowerCase();
  if (!haystack.trim()) return false;
  const matched = keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
  return matched.length / keywords.length >= 0.7;
}

function resolveStoreImportKeywords(
  keywords: string[],
  description: string,
): string[] {
  if (keywords.length === 0) return [];
  if (looksLikeTokenizedDescriptionKeywords(keywords, description)) return [];
  return keywords;
}

type ProductEditForm = {
  productName: string;
  sku: string;
  brandName: string;
  category: string;
  listingTitle: string;
  bulletPointsText: string;
  tagsText: string;
  descriptionHtml: string;
  price: string;
  currency: string;
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
  ebay?: MarketplaceSyncPlatformResult;
  synced: boolean;
};

function extractMarketplaceSync(payload: unknown): MarketplaceSyncResult | null {
  if (!payload || typeof payload !== "object") return null;
  const sync = (payload as { marketplaceSync?: MarketplaceSyncResult }).marketplaceSync;
  return sync ?? null;
}

const MARKETPLACE_SYNC_LABELS: Record<"shopify" | "woocommerce" | "amazon" | "ebay", string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  amazon: "Amazon",
  ebay: "eBay",
};

function describeMarketplaceSyncResult(sync: MarketplaceSyncResult | null | undefined): {
  syncedPlatforms: string[];
  warnings: string[];
  errors: string[];
} {
  const syncedPlatforms: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const key of ["shopify", "woocommerce", "amazon", "ebay"] as const) {
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

function bulletsToHtmlDescription(bullets: string[]): string {
  const items = bullets.map((bullet) => bullet.trim()).filter(Boolean);
  if (items.length === 0) return "";
  return `<ul>\n${items.map((bullet) => `  <li>${bullet}</li>`).join("\n")}\n</ul>`;
}

function isBulletDerivedDescription(htmlDescription: string, bullets: string[]): boolean {
  const trimmed = htmlDescription.trim();
  if (!trimmed) return true;
  return trimmed === bulletsToHtmlDescription(bullets).trim();
}

type ListingContentView = {
  title: string;
  bulletPoints: string[];
  keywords: string[];
  htmlDescription: string;
  category?: string | null;
};

function collectListingSuggestions(
  auditResult: AuditResult | null | undefined,
  productSuggestions: string[] | undefined,
): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  const add = (text: string) => {
    const normalized = text.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) return;
    seen.add(normalized.toLowerCase());
    suggestions.push(normalized);
  };

  if (auditResult) {
    for (const section of [
      auditResult.titleScore,
      auditResult.bulletScore,
      auditResult.imageScore,
      auditResult.keywordScore,
    ]) {
      for (const suggestion of section?.suggestions ?? []) add(suggestion);
      for (const issue of section?.issues ?? []) add(issue);
    }
  }

  for (const suggestion of productSuggestions ?? []) add(suggestion);

  if (suggestions.length === 0) {
    add("Click Generate Content to create SEO-optimized title, bullets, and keywords.");
  }

  return suggestions.slice(0, 8);
}

function hasGeneratedListingContent(
  audit?: { sourceListingContent?: GeneratedContent | null } | null,
): boolean {
  return Boolean(audit?.sourceListingContent);
}

function listingFieldsMatchGenerated(
  audit?: {
    title?: string | null;
    bulletPoints?: string[] | null;
    targetKeywords?: string[] | null;
    generatedContent?: GeneratedContent | null;
    sourceListingContent?: GeneratedContent | null;
  } | null,
): boolean {
  if (!audit?.sourceListingContent) return false;

  const generated = audit?.generatedContent;
  if (!generated?.title?.trim()) return false;

  const auditBullets = normalizeStringList(audit?.bulletPoints);
  const genBullets = normalizeStringList(generated.bulletPoints);
  const auditTags = normalizeStringList(audit?.targetKeywords);
  const genTags = normalizeStringList(generated.keywords);

  return audit?.title?.trim() === generated.title?.trim()
    && JSON.stringify(auditBullets) === JSON.stringify(genBullets)
    && JSON.stringify(auditTags) === JSON.stringify(genTags);
}

function toListingContentView(content: {
  title?: string | null;
  bulletPoints?: string[] | null;
  keywords?: string[] | null;
  htmlDescription?: string | null;
  category?: string | null;
} | null | undefined): ListingContentView | null {
  if (!content) return null;
  const bulletPoints = normalizeStringList(content.bulletPoints);
  const keywords = normalizeStringList(content.keywords);
  const title = content.title?.trim() ?? "";
  const htmlDescription = content.htmlDescription != null
    ? content.htmlDescription.trim()
    : bulletsToHtmlDescription(bulletPoints);
  const category = content.category?.trim() || null;

  if (!title && bulletPoints.length === 0 && keywords.length === 0 && !htmlDescription && !category) {
    return null;
  }

  return { title, bulletPoints, keywords, htmlDescription, category };
}

function resolveExistingListingContent(
  product: ProductDetailView | null | undefined,
  audit?: {
    asin?: string | null;
    productName?: string | null;
    title?: string | null;
    bulletPoints?: string[] | null;
    targetKeywords?: string[] | null;
    category?: string | null;
    storeDescriptionHtml?: string | null;
    generatedContent?: GeneratedContent | null;
    sourceListingContent?: GeneratedContent | null;
  } | null,
): ListingContentView | null {
  const isWooImport = Boolean(product?.isWooCommerceImport) || isWooCommerceImportAsin(audit?.asin);

  if (!isWooImport && audit?.sourceListingContent) {
    const snapshot = toListingContentView({
      title: audit.sourceListingContent.title,
      bulletPoints: audit.sourceListingContent.bulletPoints,
      keywords: audit.sourceListingContent.keywords,
      htmlDescription: audit.sourceListingContent.htmlDescription,
      category: product?.category ?? audit?.category ?? null,
    });
    if (snapshot) return snapshot;
  }

  const overwritten = listingFieldsMatchGenerated(audit);
  const productBullets = normalizeStringList(product?.bulletPoints);
  const auditBullets = overwritten ? [] : normalizeStringList(audit?.bulletPoints);
  const bulletPoints = isWooImport
    ? []
    : (productBullets.length > 0 ? productBullets : auditBullets);

  const productTags = normalizeStringList(product?.targetKeywords);
  const auditTags = normalizeStringList(audit?.targetKeywords);
  const rawKeywords = isWooImport ? auditTags : (productTags.length > 0 ? productTags : auditTags);
  const storeDescForTags = audit?.storeDescriptionHtml?.trim() || product?.descriptionHtml?.trim() || "";
  const keywords = isWooImport
    ? resolveStoreImportKeywords(rawKeywords, storeDescForTags)
    : rawKeywords;

  const title = isWooImport
    ? (audit?.title?.trim()
      || product?.listingTitle?.trim()
      || product?.title?.trim()
      || audit?.productName?.trim()
      || product?.name?.trim()
      || "")
    : overwritten
      ? (product?.listingTitle?.trim()
        || product?.title?.trim()
        || audit?.productName?.trim()
        || product?.name?.trim()
        || "")
      : (product?.listingTitle?.trim()
        || product?.title?.trim()
        || audit?.title?.trim()
        || audit?.productName?.trim()
        || product?.name?.trim()
        || "");

  const storeDesc = audit?.storeDescriptionHtml?.trim() || product?.descriptionHtml?.trim() || "";
  const generatedDesc = audit?.generatedContent?.htmlDescription?.trim();
  const htmlDescription = isWooImport
    ? storeDesc
    : overwritten
      ? bulletsToHtmlDescription(bulletPoints)
      : (storeDesc
        || (generatedDesc && !isBulletDerivedDescription(generatedDesc, bulletPoints)
          ? generatedDesc
          : bulletsToHtmlDescription(bulletPoints)));

  const category = product?.category?.trim() || audit?.category?.trim() || null;

  return toListingContentView({ title, bulletPoints, keywords, htmlDescription, category });
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
  if (!draft) {
    return {
      ...base,
      price: normalizePriceField(base.price),
      currency: normalizeListingCurrency(base.currency),
    };
  }
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
    currency: normalizeListingCurrency(draft.currency || base.currency),
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
    storeDescriptionHtml?: string | null;
    generatedContent?: GeneratedContent | null;
  } | null,
): ProductEditForm {
  const isWoo = Boolean(product.isWooCommerceImport);
  const generatedBullets = audit?.generatedContent?.bulletPoints?.filter(Boolean) ?? [];
  const auditBullets = audit?.bulletPoints?.filter(Boolean) ?? [];
  const productBullets = product.bulletPoints?.filter(Boolean) ?? [];
  const bullets = isWoo
    ? []
    : generatedBullets.length > 0
      ? generatedBullets
      : productBullets.length > 0
        ? productBullets
        : auditBullets;

  const generatedTags = audit?.generatedContent?.keywords?.filter(Boolean) ?? [];
  const auditTags = audit?.targetKeywords?.filter(Boolean) ?? [];
  const productTags = product.targetKeywords?.filter(Boolean) ?? [];
  const tags = isWoo
    ? auditTags
    : generatedTags.length > 0
      ? generatedTags
      : productTags.length > 0
        ? productTags
        : auditTags;

  const title = audit?.generatedContent?.title?.trim()
    || product.listingTitle?.trim()
    || product.title?.trim()
    || audit?.title?.trim()
    || product.name;
  const description = isWoo
    ? (audit?.storeDescriptionHtml?.trim() || product.descriptionHtml?.trim() || "")
    : (audit?.generatedContent?.htmlDescription?.trim()
      || product.descriptionHtml?.trim()
      || bulletsToTextarea(bullets));

  return {
    productName: product.name,
    sku: product.sku,
    brandName: product.brandName ?? audit?.brandName ?? "",
    category: product.category ?? audit?.category ?? "",
    listingTitle: title,
    bulletPointsText: bulletsToTextarea(bullets),
    tagsText: tagsToTextarea(tags),
    descriptionHtml: description,
    price: normalizePriceField(formatListingPrice(product.listingPrice, product.listingCurrency)),
    currency: normalizeListingCurrency(product.listingCurrency),
  };
}

function ListingPriceCurrencyFields({
  price,
  currency,
  onPriceChange,
  onCurrencyChange,
}: {
  price: string;
  currency: string;
  onPriceChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
}) {
  return (
    <EditDetailField label="Price">
      <div className="flex items-center gap-2">
        <Input
          value={price}
          onChange={(e) => onPriceChange(e.target.value)}
          onBlur={(e) => onPriceChange(normalizePriceField(e.target.value))}
          className="text-[11px] font-mono flex-1 min-w-0"
          placeholder="Enter price"
          inputMode="decimal"
        />
        <Select value={normalizeListingCurrency(currency)} onValueChange={onCurrencyChange}>
          <SelectTrigger className="h-9 w-[5.5rem] shrink-0 text-[11px] font-mono px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LISTING_CURRENCY_OPTIONS.map((opt) => (
              <SelectItem key={opt.code} value={opt.code} className="text-xs font-mono">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </EditDetailField>
  );
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
    && p.stageLabel,
  );
}

function formatOptimizeError(err: unknown): string {
  return formatAiErrorMessage(err);
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
  const {
    featureWorkspaceId,
    isAccountOwner,
    canEdit: wsCanEdit,
    isBillingAccountOwner,
    isAgencyAccountOverview,
    isLoading: workspaceLoading,
  } = useWorkspace();
  const showAccountProducts = isAgencyAccountOverviewDashboard(
    isBillingAccountOwner,
    isAgencyAccountOverview,
  );
  const productQueryScope = showAccountProducts ? "owner-account" : featureWorkspaceId;
  const productApiScope: ProductApiScope = { accountOverview: showAccountProducts };
  const auditQueryScope = showAccountProducts ? "account" : String(featureWorkspaceId ?? "workspace");
  const [location, navigate] = useLocation();
  const [imageFailed, setImageFailed] = useState(false);
  const [isEditingListing, setIsEditingListing] = useState(false);
  const [editForm, setEditForm] = useState<ProductEditForm | null>(null);
  const [selectedWorkflowStep, setSelectedWorkflowStep] = useState<ProductExplorerWorkflowStepId>(1);
  const [isSavingWorkflowStep, setIsSavingWorkflowStep] = useState(false);
  const [shopifyPublishOpen, setShopifyPublishOpen] = useState(false);
  const [shopifyPublishing, setShopifyPublishing] = useState(false);
  const workflowProductIdRef = useRef<number | null>(null);

  const source = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return parseProductSource(params.get("source"));
  }, [location, id]);

  const urlWorkflowIntent = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      forceOverview: params.get("step") === "overview",
      openListingStep: params.get("step") === "listing",
      openListingEdit: params.get("edit") === "listing",
    };
  }, [location, id]);

  const listingEditFromUrlRef = useRef(false);

  const canEditProduct = (source === null || source === "listing" || source === "audit")
    && (isAccountOwner || wsCanEdit("audits") || wsCanEdit("build_brand"));

  const validId = !Number.isNaN(id) && id > 0;
  const workspaceScopeReady = showAccountProducts || featureWorkspaceId != null;
  // Wait for workspace context so the first /api request uses the correct x-workspace-id (avoids sticky 404s).
  const queryEnabled = clerkLoaded && !!user && validId && !workspaceLoading && workspaceScopeReady;

  const {
    data: apiProduct,
    isLoading: apiLoading,
    isError: apiError,
    error: apiErrorObj,
  } = useQuery({
    queryKey: ["product", id, productQueryScope, source ?? "auto"],
    queryFn: () => fetchProductDetail(id, source, productApiScope),
    enabled: queryEnabled,
    retry: false,
    staleTime: 10_000,
  });

  const shouldFetchAudit = source === null || source === "listing" || source === "audit";

  const {
    data: auditData,
    isLoading: auditLoading,
    isError: auditError,
  } = useQuery({
    queryKey: productAuditQueryKey(id, auditQueryScope),
    queryFn: () => fetchAuditForProductDetail(id, showAccountProducts),
    enabled: queryEnabled && shouldFetchAudit,
    retry: 1,
  });

  const product = useMemo((): ProductDetailView | null => {
    if (isValidProductDetail(apiProduct)) {
      return normalizeStoreImportProductDetail(apiProduct, auditData);
    }
    if (apiLoading || (shouldFetchAudit && auditLoading)) return null;
    if (auditData && shouldFetchAudit) {
      return normalizeStoreImportProductDetail(
        mapAuditToProductDetail(auditData, "Account Owner", {
          sourceType: source === "audit" ? "audit" : "listing",
        }),
        auditData,
      );
    }
    return null;
  }, [apiProduct, apiLoading, auditData, auditLoading, shouldFetchAudit, source]);

  const optimizeAuditId = useMemo(
    () => resolveOptimizeAuditId(product, auditData?.id, source),
    [product, auditData?.id, source],
  );

  const shouldFetchLinkedAudit = queryEnabled
    && optimizeAuditId != null
    && optimizeAuditId !== id;

  const { data: linkedAuditData } = useQuery({
    queryKey: productAuditQueryKey(optimizeAuditId ?? 0, auditQueryScope),
    queryFn: () => fetchAuditForProductDetail(optimizeAuditId ?? 0, showAccountProducts),
    enabled: shouldFetchLinkedAudit,
    retry: 1,
  });

  const effectiveAudit = useMemo(() => {
    if (!optimizeAuditId) return auditData;
    if (auditData?.id === optimizeAuditId) return auditData;
    return linkedAuditData ?? auditData;
  }, [auditData, linkedAuditData, optimizeAuditId]);

  const generateContent = useGenerateContent();
  const { data: listingContentMarketplaceData, isLoading: marketplacesLoading } = useListingContentMarketplaces();
  const contentMarketplaces = listingContentMarketplaceData?.marketplaces ?? [];
  const [contentMarketplaceId, setContentMarketplaceId] = useState<number | undefined>(undefined);
  const [listingPreviewMarketplaceId, setListingPreviewMarketplaceId] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!contentMarketplaces.length) return;
    const saved = (effectiveAudit as { contentMarketplaceId?: number | null } | undefined)?.contentMarketplaceId;
    setContentMarketplaceId((prev) =>
      pickDefaultMarketplaceId(contentMarketplaces, saved ?? prev) ?? contentMarketplaces[0]?.id,
    );
  }, [contentMarketplaces, effectiveAudit]);

  const contentVariants = useMemo((): ContentVariantRow[] => {
    const raw = (effectiveAudit as { contentVariants?: ContentVariantRow[] } | null)?.contentVariants;
    return raw ?? [];
  }, [effectiveAudit]);

  const resolvedSource = product?.sourceType ?? source ?? "listing";

  const marketplacesQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("source", resolvedSource);
    if (showAccountProducts) params.set("scope", "account");
    return params.toString();
  }, [resolvedSource, showAccountProducts]);

  const { data: marketplaceData } = useQuery({
    queryKey: ["product-marketplaces", id, productQueryScope, resolvedSource],
    queryFn: () => fetchJson<{
      liveMarketplaces?: string[];
      listedMarketplaces?: string[];
      activeCount: number;
      listings?: Array<{
        marketplace: string;
        status: MarketplaceListingStatus;
        statusLabel: string;
        price: number | null;
        currency: string;
        sku: string | null;
      }>;
    }>(`${basePath}/api/products/${id}/marketplaces?${marketplacesQueryString}`, productApiFetchInit(productApiScope)),
    enabled: queryEnabled && id > 0,
    staleTime: 15_000,
  });

  const liveMarketplaces = marketplaceData?.liveMarketplaces ?? [];

  const referenceResearch = (effectiveAudit as { referenceResearch?: ReferenceResearchData | null } | null)
    ?.referenceResearch ?? null;

  const workflowStepCompleted = useMemo(
    () => productExplorerStepCompletedFromData({
      imageUrls: effectiveAudit?.imageUrls,
      imageRecords: effectiveAudit?.imageRecords,
      productImageUrl: product?.imageUrl,
      generatedContent: effectiveAudit?.generatedContent,
      title: effectiveAudit?.title,
      bulletPoints: effectiveAudit?.bulletPoints,
      generatedImages: effectiveAudit?.generatedImages,
      liveMarketplaceCount: liveMarketplaces.length,
      marketplaceActiveCount: marketplaceData?.activeCount ?? 0,
      totalOrders: product?.stats.totalOrders,
      totalRevenue: product?.stats.revenue,
    }),
    [
      effectiveAudit?.imageUrls,
      effectiveAudit?.imageRecords,
      effectiveAudit?.generatedContent,
      effectiveAudit?.title,
      effectiveAudit?.bulletPoints,
      effectiveAudit?.generatedImages,
      product?.imageUrl,
      product?.stats.totalOrders,
      product?.stats.revenue,
      liveMarketplaces.length,
      marketplaceData?.activeCount,
    ],
  );

  const listingProduct = useMemo((): ProductDetailView | null => {
    if (!product) return null;

    const shopifyListing = marketplaceData?.listings?.find((listing) => listing.marketplace === "Shopify");
    const amazonListing = marketplaceData?.listings?.find((listing) => listing.marketplace === "Amazon");
    const wooListing = marketplaceData?.listings?.find((listing) => listing.marketplace === "WooCommerce");
    const isWooImport = Boolean(product.isWooCommerceImport)
      || isWooCommerceImportAsin(effectiveAudit?.asin);
    const auditBullets = normalizeStringList(effectiveAudit?.bulletPoints);
    const generatedBullets = normalizeStringList(effectiveAudit?.generatedContent?.bulletPoints);
    const auditTags = normalizeStringList(effectiveAudit?.targetKeywords);
    const productBullets = normalizeStringList(product.bulletPoints);
    const productTags = normalizeStringList(product.targetKeywords);

    const listingPrice = resolvePositivePrice(
      product.listingPrice,
      shopifyListing?.price,
      amazonListing?.price,
      wooListing?.price,
    );
    const listingCurrency = product.listingCurrency
      ?? shopifyListing?.currency
      ?? amazonListing?.currency
      ?? wooListing?.currency
      ?? null;

    return {
      ...product,
      sku: product.sku || shopifyListing?.sku || product.sku,
      listingTitle: product.listingTitle?.trim()
        || product.title?.trim()
        || effectiveAudit?.title?.trim()
        || product.name,
      bulletPoints: isWooImport
        ? []
        : productBullets.length > 0
          ? productBullets
          : auditBullets.length > 0
            ? auditBullets
            : generatedBullets,
      targetKeywords: isWooImport
        ? auditTags
        : productTags.length > 0
          ? productTags
          : auditTags,
      descriptionHtml: product.descriptionHtml?.trim()
        || (effectiveAudit as { storeDescriptionHtml?: string | null } | undefined)?.storeDescriptionHtml?.trim()
        || effectiveAudit?.generatedContent?.htmlDescription?.trim()
        || "",
      listingPrice,
      listingCurrency,
    };
  }, [product, marketplaceData, effectiveAudit]);

  const existingListingContent = useMemo(() => {
    const content = resolveExistingListingContent(listingProduct, effectiveAudit);
    if (!content || !isStoreImportProduct(listingProduct)) return content;
    return { ...content, bulletPoints: [] };
  }, [listingProduct, effectiveAudit]);

  /** Same baseline as PATCH /content-variants field merge (source snapshot, not UI-trimmed existing). */
  const sourceListingForPreviewMerge = useMemo((): GeneratedContent => {
    const snap = (effectiveAudit as { sourceListingContent?: GeneratedContent | null } | undefined)
      ?.sourceListingContent;
    if (snap) {
      return {
        title: snap.title ?? "",
        bulletPoints: snap.bulletPoints ?? [],
        keywords: snap.keywords ?? [],
        htmlDescription: snap.htmlDescription ?? "",
        attributes: snap.attributes,
      };
    }
    const view = resolveExistingListingContent(listingProduct, effectiveAudit);
    return {
      title: view?.title ?? "",
      bulletPoints: view?.bulletPoints ?? [],
      keywords: view?.keywords ?? [],
      htmlDescription: view?.htmlDescription ?? "",
      attributes: view?.attributes,
    };
  }, [effectiveAudit, listingProduct]);

  const listingSuggestions = useMemo(
    () => collectListingSuggestions(effectiveAudit?.result, product?.aiSuggestions),
    [effectiveAudit?.result, product?.aiSuggestions],
  );

  const hasGeneratedListing = useMemo(
    () => hasGeneratedListingContent(effectiveAudit),
    [effectiveAudit],
  );

  const productImageUrls = useMemo(() => {
    const urls: string[] = [];
    const add = (url: string | undefined | null) => {
      const trimmed = url?.trim();
      if (trimmed && !urls.includes(trimmed)) urls.push(trimmed);
    };
    for (const url of product?.imageUrls ?? []) add(url);
    for (const url of effectiveAudit?.imageUrls ?? []) add(url);
    if (urls.length === 0) add(product?.imageUrl);
    return urls;
  }, [product?.imageUrls, product?.imageUrl, effectiveAudit?.imageUrls]);

  /** Overview tab: imported / live listing only — never AI-optimized or merged variant copy. */
  const overviewPreview = useMemo(() => {
    const title =
      existingListingContent?.title?.trim()
      || listingProduct?.listingTitle?.trim()
      || listingProduct?.title?.trim()
      || effectiveAudit?.title?.trim()
      || product?.name
      || "";
    const bulletPoints =
      (existingListingContent?.bulletPoints?.length
        ? existingListingContent.bulletPoints
        : null)
      ?? listingProduct?.bulletPoints
      ?? effectiveAudit?.bulletPoints
      ?? [];
    const descriptionHtml =
      existingListingContent?.htmlDescription?.trim()
      || listingProduct?.descriptionHtml?.trim()
      || listingProduct?.description?.trim()
      || (effectiveAudit as { storeDescriptionHtml?: string | null } | undefined)?.storeDescriptionHtml?.trim()
      || null;
    const attributes = referenceResearch?.productDetails?.filter(
      (row) => row.attribute?.trim() && row.value?.trim(),
    ) ?? [];
    return {
      imageUrls: productImageUrls,
      title,
      bulletPoints: Array.isArray(bulletPoints) ? bulletPoints : [],
      descriptionHtml,
      attributes,
    };
  }, [
    existingListingContent,
    listingProduct,
    effectiveAudit?.title,
    effectiveAudit?.bulletPoints,
    effectiveAudit,
    product?.name,
    productImageUrls,
    referenceResearch?.productDetails,
  ]);

  /** Listing Preview: only marketplaces with generated optimized content on this audit. */
  const listingPreviewMarketplaces = useMemo((): ContentMarketplaceOption[] => {
    const generatedIds = new Set<number>();
    for (const row of contentVariants) {
      const preview = variantToPreviewGeneratedContent(
        row.generatedContent as ContentVariantWithMeta,
        sourceListingForPreviewMerge,
      );
      if (preview) generatedIds.add(row.contentMarketplaceId);
    }
    const legacyId = (effectiveAudit as { contentMarketplaceId?: number | null })?.contentMarketplaceId;
    if (legacyId != null && effectiveAudit?.generatedContent?.title?.trim()) {
      generatedIds.add(legacyId);
    }
    const ordered = contentMarketplaces.filter((m) => generatedIds.has(m.id));
    if (ordered.length > 0) return ordered;
    if (legacyId != null && effectiveAudit?.generatedContent?.title?.trim()) {
      const legacyMeta = contentMarketplaces.find((m) => m.id === legacyId);
      if (legacyMeta) return [legacyMeta];
    }
    return [];
  }, [contentVariants, contentMarketplaces, effectiveAudit?.generatedContent, effectiveAudit, sourceListingForPreviewMerge]);

  useEffect(() => {
    if (listingPreviewMarketplaces.length === 0) {
      setListingPreviewMarketplaceId(undefined);
      return;
    }
    setListingPreviewMarketplaceId((prev) => (
      prev != null && listingPreviewMarketplaces.some((m) => m.id === prev)
        ? prev
        : listingPreviewMarketplaces[0]?.id
    ));
  }, [listingPreviewMarketplaces]);

  /** Listing Preview tab: merged optimized copy for the selected preview marketplace (user field picks). */
  const listingPreviewGeneratedContent = useMemo((): GeneratedContent | null => {
    if (listingPreviewMarketplaceId != null) {
      const fromTab = contentVariants.find((v) => v.contentMarketplaceId === listingPreviewMarketplaceId)
        ?.generatedContent as ContentVariantWithMeta | undefined;
      const tabContent = variantToPreviewGeneratedContent(fromTab, sourceListingForPreviewMerge);
      if (tabContent) return tabContent;
    }
    const legacyId = (effectiveAudit as { contentMarketplaceId?: number | null })?.contentMarketplaceId;
    if (legacyId != null && listingPreviewMarketplaceId === legacyId) {
      return effectiveAudit?.generatedContent ?? null;
    }
    if (listingPreviewMarketplaces.length === 0) {
      return null;
    }
    return null;
  }, [
    listingPreviewMarketplaceId,
    contentVariants,
    effectiveAudit?.generatedContent,
    effectiveAudit,
    listingPreviewMarketplaces.length,
    sourceListingForPreviewMerge,
  ]);

  useEffect(() => {
    if (productImageUrls.length === 0) return;
    const auditId = optimizeAuditId ?? id;
    queryClient.setQueryData<GetAuditQueryResult>(
      productAuditQueryKey(auditId, auditQueryScope),
      (current) => {
        if (!current) return current;
        const merged = [...(current.imageUrls ?? [])];
        for (const url of productImageUrls) {
          if (!merged.includes(url)) merged.push(url);
        }
        return { ...current, imageUrls: merged };
      },
    );
  }, [productImageUrls, optimizeAuditId, id, queryClient]);

  async function refreshProductData() {
    const auditId = optimizeAuditId ?? product?.statsAuditId ?? id;
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["product", id, productQueryScope, source ?? "auto"] }),
      queryClient.refetchQueries({ queryKey: productAuditQueryKey(auditId, auditQueryScope) }),
      queryClient.refetchQueries({ queryKey: productAuditQueryKey(id, auditQueryScope) }),
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

  const isLoading = queryEnabled && !product && (apiLoading || (shouldFetchAudit && auditLoading));

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

  const publishWooCommerceMutation = useMutation({
    mutationFn: async (publishMode: "draft" | "live") => {
      const auditId = optimizeAuditId ?? product?.statsAuditId ?? id;
      return publishAuditToWooCommerce({ auditId, publishMode });
    },
    onSuccess: (result, publishMode) => {
      void queryClient.invalidateQueries({ queryKey: ["product", id, productQueryScope, source ?? "auto"] });
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
      void queryClient.invalidateQueries({ queryKey: ["product", id, productQueryScope, source ?? "auto"] });
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

  const syncToStoreMutation = useMutation({
    mutationFn: async () => {
      const auditId = optimizeAuditId ?? product?.statsAuditId ?? id;
      const response = await fetchJson<{ marketplaceSync?: MarketplaceSyncResult }>(
        `${basePath}/api/audits/${auditId}/sync-marketplaces`,
        { method: "POST" },
      );
      return extractMarketplaceSync(response);
    },
    onSuccess: async (marketplaceSync) => {
      await refreshProductData();
      void queryClient.invalidateQueries({ queryKey: ["product-marketplaces", id, resolvedSource] });

      const { syncedPlatforms, warnings, errors } = describeMarketplaceSyncResult(marketplaceSync);

      if (syncedPlatforms.length > 0) {
        const syncedDescription = syncedPlatforms.length === 1
          ? `${syncedPlatforms[0]} listing updated with your latest content and images.`
          : `${syncedPlatforms.join(", ")} listings updated with your latest content and images.`;
        if (errors.length > 0) {
          toast({
            title: "Synced with partial errors",
            description: `${syncedDescription} ${errors.join(" ")}`,
            variant: "destructive",
          });
          return;
        }
        if (warnings.length > 0) {
          toast({
            title: "Synced with a warning",
            description: `${syncedDescription} ${warnings.join(" ")}`,
            variant: "destructive",
          });
          return;
        }
        toast({
          title: syncedPlatforms.length === 1
            ? `Synced to ${syncedPlatforms[0]}`
            : `Synced to ${syncedPlatforms.join(", ")}`,
          description: syncedDescription,
        });
        return;
      }

      if (errors.length > 0) {
        toast({
          title: "Marketplace sync failed",
          description: errors.join(" "),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Nothing to sync",
        description: "Connect your store on Marketplaces or list this product first.",
      });
    },
    onError: (error) => {
      const description = error instanceof ApiFetchError && error.status === 401
        ? "Your session expired or the server could not verify your login. Sign in again and retry."
        : error instanceof Error
          ? error.message
          : "Could not sync to your store.";
      toast({
        title: "Sync failed",
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
      }

      if (parsedPrice != null) {
        payload.price = String(parsedPrice);
      }
      payload.currency = normalizeListingCurrency(data.currency);

      if (isStoreImportProduct(product)) {
        payload.syncMarketplaces = true;
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
          ? `${syncedPlatforms[0]} listing updated with your latest content, images, pricing, and SKU (where supported).`
          : `${syncedPlatforms.join(", ")} listings updated with your latest content, images, pricing, and SKU (where supported).`;
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
    if (urlWorkflowIntent.openListingStep) {
      setSelectedWorkflowStep(2);
      return;
    }
    setSelectedWorkflowStep(
      resolveInitialProductExplorerStep(
        workflowStepCompleted,
        product.currentStep,
        { forceOverview: urlWorkflowIntent.forceOverview },
      ),
    );
  }, [
    product?.id,
    product?.currentStep,
    urlWorkflowIntent.forceOverview,
    urlWorkflowIntent.openListingStep,
    workflowStepCompleted,
  ]);

  useEffect(() => {
    listingEditFromUrlRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!urlWorkflowIntent.forceOverview || !urlWorkflowIntent.openListingEdit) return;
    if (!listingProduct || !canEditProduct || listingEditFromUrlRef.current) return;
    listingEditFromUrlRef.current = true;
    setSelectedWorkflowStep(1);
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

  function openListingEditor() {
    if (!canEditProduct || !listingProduct) return;
    setSelectedWorkflowStep(1);
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
    void queryClient.invalidateQueries({ queryKey: ["product", id, productQueryScope, source ?? "auto"] });
    void queryClient.invalidateQueries({ queryKey: productAuditQueryKey(auditId, auditQueryScope) });
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
            setShopifyPublishOpen(true);
          }
        },
      });
      return;
    }
    if (product?.isWooCommerceImport) {
      publishWooCommerceMutation.mutate("live");
      return;
    }
    setShopifyPublishOpen(true);
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

  const canPublishToStore = Boolean(isStoreImportProduct(product) && canEditProduct);
  const isPublishingToStore = shopifyPublishing
    || publishWooCommerceMutation.isPending
    || syncToStoreMutation.isPending;
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

  function handleOptimizeContent(marketplaceIds: number[]) {
    if (!optimizeAuditId) {
      toast({
        title: "Cannot optimize",
        description: "This product has no linked listing audit.",
        variant: "destructive",
      });
      return;
    }
    if (!canEditProduct) return;
    const ids = marketplaceIds.length > 0 ? marketplaceIds : (contentMarketplaceId != null ? [contentMarketplaceId] : []);

    generateContent.mutate(
      { id: optimizeAuditId, data: { contentMarketplaceIds: ids } },
      {
        onSuccess: (payload: GeneratedContent & {
          contentMarketplaceId?: number;
          contentVariants?: ContentVariantRow[];
          batchResults?: Array<{ contentMarketplaceId: number; ok: boolean; error?: string }>;
        }) => {
          const generatedContent: GeneratedContent = {
            title: payload.title,
            bulletPoints: payload.bulletPoints,
            keywords: payload.keywords,
            htmlDescription: payload.htmlDescription,
          };
          const sourceSnapshot = existingListingContent
            ? {
                title: existingListingContent.title,
                bulletPoints: existingListingContent.bulletPoints,
                keywords: existingListingContent.keywords,
                htmlDescription: existingListingContent.htmlDescription,
              }
            : undefined;

          const mergeAudit = (current: GetAuditQueryResult | undefined) => (current
            ? {
                ...current,
                generatedContent,
                contentMarketplaceId: payload.contentMarketplaceId ?? current.contentMarketplaceId,
                contentVariants: payload.contentVariants ?? current.contentVariants,
                sourceListingContent: current.sourceListingContent ?? sourceSnapshot,
              }
            : current);

          queryClient.setQueryData<GetAuditQueryResult>(
            productAuditQueryKey(optimizeAuditId, auditQueryScope),
            mergeAudit,
          );
          if (optimizeAuditId !== id) {
            queryClient.setQueryData<GetAuditQueryResult>(
              productAuditQueryKey(id, auditQueryScope),
              mergeAudit,
            );
          }
          if (payload.contentMarketplaceId != null) {
            setContentMarketplaceId(payload.contentMarketplaceId);
          }
          void queryClient.invalidateQueries({ queryKey: ["product", id, productQueryScope, source ?? "auto"] });
          void queryClient.invalidateQueries({
            queryKey: productAuditQueryKey(optimizeAuditId, auditQueryScope),
          });
          refreshCreditBalances(queryClient);

          const okCount = payload.batchResults?.filter((r) => r.ok).length ?? ids.length;
          const failCount = payload.batchResults?.filter((r) => !r.ok).length ?? 0;
          toast({
            title: failCount > 0 ? "Partially generated" : "Optimized content ready",
            description: failCount > 0
              ? `${okCount} marketplace(s) succeeded, ${failCount} failed. ${okCount} AI credit(s) used.`
              : `${okCount} marketplace(s) updated. ${okCount} AI credit(s) used.`,
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

  const ribbonDisplayName =
    product.isShopifyImport || product.isWooCommerceImport
      ? (listingProduct?.listingTitle ?? listingProduct?.title ?? product.name)
      : product.name;

  return (
    <div className="space-y-3 animate-in fade-in duration-300 pb-6">
      <ProductDetailRibbon
        productId={product.id}
        productName={product.name}
        displayName={ribbonDisplayName}
        statusLabel={product.statusLabel}
        imageUrl={imageSrc}
        onImageError={() => setImageFailed(true)}
      />

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
          brandName={product.brandName}
          category={product.category}
          productImageUrl={product.imageUrl}
          audit={effectiveAudit}
          generatedContent={listingPreviewGeneratedContent}
          listingPreviewMarketplaces={listingPreviewMarketplaces}
          listingPreviewMarketplaceId={listingPreviewMarketplaceId}
          onListingPreviewMarketplaceChange={setListingPreviewMarketplaceId}
          existingContent={existingListingContent}
          suggestions={listingSuggestions}
          hasGeneratedContent={hasGeneratedListing}
          productImageUrls={productImageUrls}
          isOptimizing={isOptimizingContent}
          onOptimize={() => handleOptimizeContent(contentMarketplaceId != null ? [contentMarketplaceId] : [])}
          optimizeDisabled={!canOptimizeContent}
          productId={product.id}
          productSource={resolvedSource}
          canPublishMarketplaces={canEditProduct}
          onSaveAndContinue={() => void saveAndContinueWorkflowStep()}
          isSavingContinue={isSavingWorkflowStep}
          showStoreSync={canPublishToStore && Boolean(storePublishReady)}
          storePlatformLabel={storePlatformLabel}
          onSyncToStore={() => syncToStoreMutation.mutate()}
          isSyncingStore={syncToStoreMutation.isPending}
          referenceResearch={referenceResearch}
          OptimizedContentPanel={(panelProps) => (
            <ListingMarketplaceContentPanel
              contentMarketplaces={contentMarketplaces}
              contentMarketplaceId={contentMarketplaceId}
              onContentMarketplaceChange={setContentMarketplaceId}
              contentVariants={contentVariants}
              legacyGeneratedContent={effectiveAudit?.generatedContent}
              legacyMarketplaceId={(effectiveAudit as { contentMarketplaceId?: number | null })?.contentMarketplaceId}
              suggestions={panelProps.suggestions}
              isOptimizing={panelProps.isOptimizing}
              onGenerate={handleOptimizeContent}
              optimizeDisabled={panelProps.optimizeDisabled}
              marketplacesLoading={marketplacesLoading}
              existingContent={existingListingContent}
              storeDescriptionHtml={
                listingProduct?.descriptionHtml
                ?? (effectiveAudit as { storeDescriptionHtml?: string | null } | undefined)?.storeDescriptionHtml
              }
              showListingCompare={shouldShowExistingListingContent(listingProduct, effectiveAudit)}
              auditId={optimizeAuditId}
              onContentVariantsUpdated={(variants) => {
                const mergeAudit = (current: GetAuditQueryResult | undefined) => (current
                  ? { ...current, contentVariants: variants }
                  : current);
                if (optimizeAuditId != null) {
                  queryClient.setQueryData(
                    productAuditQueryKey(optimizeAuditId, auditQueryScope),
                    mergeAudit,
                  );
                }
                if (optimizeAuditId !== id) {
                  queryClient.setQueryData(
                    productAuditQueryKey(id, auditQueryScope),
                    mergeAudit,
                  );
                }
              }}
            />
          )}
          overviewContent={
            <ProductExplorerOverviewPreview
              imageUrls={overviewPreview.imageUrls}
              title={overviewPreview.title}
              bulletPoints={overviewPreview.bulletPoints}
              descriptionHtml={overviewPreview.descriptionHtml}
              attributes={overviewPreview.attributes}
            />
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
                    <ListingPriceCurrencyFields
                      price={editForm.price}
                      currency={editForm.currency}
                      onPriceChange={(value) => updateEditField("price", value)}
                      onCurrencyChange={(value) => updateEditField("currency", value)}
                    />
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
                    <ListingPriceCurrencyFields
                      price={editForm.price}
                      currency={editForm.currency}
                      onPriceChange={(value) => updateEditField("price", value)}
                      onCurrencyChange={(value) => updateEditField("currency", value)}
                    />
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
                    <EditDetailField label="Created Date">
                      <p className="text-xs text-slate-500 py-1.5">{createdDate}</p>
                    </EditDetailField>
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

      <ShopifyPublishCollectionsDialog
        auditId={optimizeAuditId ?? product?.statsAuditId ?? id}
        open={shopifyPublishOpen}
        onOpenChange={(open) => {
          setShopifyPublishOpen(open);
          if (!open) setShopifyPublishing(false);
        }}
        onPublishingChange={setShopifyPublishing}
        publishMode="live"
        onPublished={(result) => {
          void queryClient.invalidateQueries({ queryKey: ["product", id, productQueryScope, source ?? "auto"] });
          void queryClient.invalidateQueries({ queryKey: ["product-marketplaces", id] });
          const collectionNote = result.collectionsAssigned?.length
            ? ` Added to ${result.collectionsAssigned.map((c) => c.title ?? "collection").join(", ")}.`
            : "";
          if (result.warning) {
            toast({
              title: "Published with a warning",
              description: `${result.warning}${collectionNote}`,
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "Published to Shopify",
            description: result.listingUrl
              ? `Your listing is live on your Shopify Online Store.${collectionNote}`
              : `${result.message}${collectionNote}`,
          });
        }}
      />
    </div>
  );
}
