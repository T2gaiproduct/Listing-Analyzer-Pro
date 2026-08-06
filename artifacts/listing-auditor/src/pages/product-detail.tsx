import { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  FolderOpen,
  Link2,
  Loader2,
  Package,
  Pencil,
  Sparkles,
  Star,
} from "lucide-react";
import { useGetAudit, getGetAuditQueryKey, useGenerateContent } from "@workspace/api-client-react";
import type { GeneratedContent } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScoreRing } from "@/components/score-ring";
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
import { ProductOrdersTab } from "@/components/product-orders-tab";
import { ProductSalesTab } from "@/components/product-sales-tab";
import { ProductMarketplacesTab } from "@/components/product-marketplaces-tab";
import { ProductDetailRibbon } from "@/components/product-detail-ribbon";

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

type TabId = "overview" | "workflow" | "marketplaces" | "orders" | "sales";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "workflow", label: "Workflow" },
  { id: "marketplaces", label: "Marketplaces" },
  { id: "orders", label: "Orders" },
  { id: "sales", label: "Sales" },
];

type ProductEditForm = {
  productName: string;
  sku: string;
  brandName: string;
  category: string;
  assignedManager: string;
  priority: "high" | "medium" | "low";
  notes: string;
};

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

function AiSuggestionsCard({
  auditScore,
  suggestions,
  generatedContent,
  workflowUrl,
  onNavigate,
  onOptimizeContent,
  isOptimizing,
  optimizeDisabled,
}: {
  auditScore: number | null;
  suggestions: string[];
  generatedContent?: GeneratedContent | null;
  workflowUrl: string;
  onNavigate: (url: string) => void;
  onOptimizeContent: () => void;
  isOptimizing: boolean;
  optimizeDisabled?: boolean;
}) {
  const items = suggestions.length > 0
    ? suggestions
    : ["Complete your listing workflow to unlock personalized AI suggestions"];

  const starRating = auditScore != null && auditScore > 0
    ? (auditScore / 20).toFixed(1)
    : null;

  const contentBullets = generatedContent?.bulletPoints?.filter(Boolean) ?? [];

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-orange-600" />
        <h2 className="text-xs font-semibold text-orange-900">AI Suggestions</h2>
      </div>

      {auditScore != null && auditScore > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200/80 bg-white/70 px-3 py-2.5">
          <ScoreRing score={auditScore} size="sm" showLabel={false} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-orange-800/80">
              Audit Score
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-sm font-semibold text-slate-900 tabular-nums">{auditScore}/100</span>
              {starRating && (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-600">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  {starRating}/5
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-orange-200/80 bg-white/50 px-3 py-2">
          <p className="text-[11px] text-slate-600">
            No audit score yet. Run an audit in the workflow to unlock scored suggestions.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-orange-800/80">
          Optimized Content
        </p>
        {generatedContent?.title ? (
          <div className="rounded-lg border border-orange-200/80 bg-white/70 overflow-hidden">
            <div className="max-h-48 overflow-y-auto overscroll-contain px-3 py-2.5 space-y-2">
              <p className="text-[11px] font-medium text-slate-900 leading-snug whitespace-pre-wrap break-words">
                {generatedContent.title}
              </p>
              {contentBullets.length > 0 && (
                <ul className="space-y-1.5 pl-3.5 list-disc marker:text-orange-300">
                  {contentBullets.map((bullet, index) => (
                    <li
                      key={`${index}-${bullet.slice(0, 24)}`}
                      className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-600 px-0.5">
            No optimized content yet. Use the button below to generate listing copy (1 AI credit).
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-orange-800/80">
          Suggestions
        </p>
        <ul className="space-y-1.5 pl-4 list-disc marker:text-orange-400">
          {items.map((suggestion) => (
            <li key={suggestion} className="text-[11px] text-slate-800 leading-relaxed">
              {suggestion}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={onOptimizeContent}
          disabled={optimizeDisabled || isOptimizing}
        >
          {isOptimizing ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Optimizing…
            </>
          ) : (
            "Optimize content (1 AI credit)"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] bg-orange-100/80 border-orange-200 text-orange-900 hover:bg-orange-100"
          onClick={() => onNavigate(workflowUrl)}
        >
          Generate images
          <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
        </Button>
      </div>
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
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [imageFailed, setImageFailed] = useState(false);
  const [isEditingListing, setIsEditingListing] = useState(false);
  const [editForm, setEditForm] = useState<ProductEditForm | null>(null);

  const source = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return parseProductSource(params.get("source"));
  }, [location, id]);

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
    if (isValidProductDetail(apiProduct)) return apiProduct;
    if (auditData && shouldFetchAudit) {
      return mapAuditToProductDetail(auditData, "Account Owner", {
        sourceType: source === "audit" ? "audit" : "listing",
      });
    }
    return null;
  }, [apiProduct, auditData, shouldFetchAudit, source]);

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

  useEffect(() => {
    if (!product?.sourceType) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === product.sourceType) return;
    navigate(`/products/${id}?source=${product.sourceType}`, { replace: true });
  }, [product?.sourceType, id, navigate]);

  const isLoading = queryEnabled && apiLoading && !product && !(shouldFetchAudit && auditLoading);

  const workflowTitle = product?.sourceTypeLabel ?? "Project Workflow";

  const saveProductMutation = useMutation({
    mutationFn: async (data: ProductEditForm) => {
      const payload = {
        productName: data.productName.trim(),
        brandName: data.brandName.trim(),
        category: data.category.trim(),
        sku: data.sku.trim(),
        priority: data.priority,
        assignedManager: data.assignedManager.trim(),
        notes: data.notes.trim(),
      };

      try {
        await fetchJson(`${basePath}/api/audits/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        if (error instanceof ApiFetchError && error.status === 404) {
          await fetchJson(`${basePath}/api/products/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["product", id, featureWorkspaceId] });
      void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(id) });
      setIsEditingListing(false);
      setEditForm(null);
      toast({ title: "Saved", description: "Product details updated." });
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
              ? "This product could not be loaded. It may have been removed, or the project type may not match this URL. Try opening it again from the Products tab."
              : "This product may have been removed or you may not have access to it in the current workspace."}
        </p>
        <div className="flex gap-2 mt-5">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link href="/products">Back to Products</Link>
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
    if (!canEditProduct || !product) return;
    setActiveTab("overview");
    setEditForm({
      productName: product.name,
      sku: product.sku,
      brandName: product.brandName ?? "",
      category: product.category ?? "",
      assignedManager: product.manager?.name ?? "",
      priority: product.priorityLevel ?? "medium",
      notes: product.notes ?? "",
    });
    setIsEditingListing(true);
  }

  function cancelListingEditor() {
    setIsEditingListing(false);
    setEditForm(null);
  }

  function saveListingEditor() {
    if (!editForm) return;
    if (!editForm.productName.trim() || !editForm.sku.trim()) {
      toast({
        title: "Missing fields",
        description: "Product name and SKU are required.",
        variant: "destructive",
      });
      return;
    }
    saveProductMutation.mutate(editForm);
  }

  function updateEditField<K extends keyof ProductEditForm>(key: K, value: ProductEditForm[K]) {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const canOptimizeContent = canEditProduct && optimizeAuditId != null;
  const isOptimizingContent = generateContent.isPending;

  function handleOptimizeContent() {
    if (!optimizeAuditId) {
      toast({
        title: "Cannot optimize",
        description: "This product has no linked listing audit. Open the workflow to create one first.",
        variant: "destructive",
      });
      return;
    }
    if (!canEditProduct) return;

    generateContent.mutate(
      { id: optimizeAuditId },
      {
        onSuccess: () => {
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
                <h1 className="text-base font-semibold text-slate-900 truncate">{product.name}</h1>
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

      {/* Tabs + quick actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((tab) => (
          <span key={tab.id} className="contents">
            <button
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-8 px-3.5 rounded-lg text-[11px] font-medium border transition-colors",
                activeTab === tab.id
                  ? "bg-orange-50 text-orange-700 border-orange-200 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              )}
            >
              {tab.label}
            </button>

            {tab.id === "overview" && (
              <>
                <button
                  type="button"
                  onClick={openListingEditor}
                  disabled={!canEditProduct}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11px] font-medium border transition-colors",
                    isEditingListing
                      ? "bg-slate-100 text-slate-800 border-slate-300 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    !canEditProduct && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <Pencil className="w-3 h-3 opacity-70" />
                  Edit Listing
                </button>
                <button
                  type="button"
                  onClick={handleOptimizeContent}
                  disabled={!canOptimizeContent || isOptimizingContent}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11px] font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors",
                    (!canOptimizeContent || isOptimizingContent) && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {isOptimizingContent ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Optimizing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 opacity-70" />
                      Optimize Content
                    </>
                  )}
                </button>
              </>
            )}
          </span>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-900">Product Details</h2>
              {isEditingListing && editForm && (
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
                        Saving…
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              )}
            </div>

            {isEditingListing && editForm ? (
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
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <DetailField label="Product Name">{product.name}</DetailField>
              <DetailField label="SKU">
                <span className="font-mono text-[11px]">{product.sku}</span>
              </DetailField>
              <DetailField label="Brand">{product.brandName || "—"}</DetailField>
              <DetailField label="Category">{product.category || "—"}</DetailField>
              <DetailField label="Assigned Manager">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold flex items-center justify-center">
                    {product.manager?.initials ?? "?"}
                  </span>
                  <span>{product.manager?.name ?? "—"}</span>
                </div>
              </DetailField>
              <DetailField label="Created Date">{createdDate}</DetailField>
              <DetailField label="Priority">
                <PriorityBadge
                  label={(product.priorityLabel ?? "Medium Priority").replace(" Priority", "")}
                  level={product.priorityLevel}
                />
              </DetailField>
              <DetailField label="Current Stage">
                <LiveBadge label={product.stageLabel} />
              </DetailField>
            </div>
            )}

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2">
                  Reference Links
                </p>
                {product.referenceLinks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {product.referenceLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-blue-200 bg-blue-50 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <Link2 className="w-3 h-3" />
                        {link.label}
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">No reference links yet. Add competitors in the workflow.</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-2">
                  Project Folder
                </p>
                <Link
                  href={product.driveFolderUrl || product.workflowUrl}
                  className="inline-flex items-center gap-1.5 text-[11px] text-orange-600 font-medium hover:text-orange-700 hover:underline transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  {product.driveFolder}
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <AiSuggestionsCard
              auditScore={product.stats.listingScore > 0 ? product.stats.listingScore : effectiveAudit?.overallScore ?? null}
              suggestions={product.aiSuggestions ?? []}
              generatedContent={effectiveAudit?.generatedContent ?? null}
              workflowUrl={product.workflowUrl}
              onNavigate={navigate}
              onOptimizeContent={handleOptimizeContent}
              isOptimizing={isOptimizingContent}
              optimizeDisabled={!canOptimizeContent}
            />
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-semibold text-slate-900 mb-2">Notes</h2>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {isEditingListing && editForm ? editForm.notes : product.notes}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold text-slate-900">Quick Stats</h2>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Total Orders</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{product.stats.totalOrders}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Revenue</span>
                  <span className="font-semibold text-emerald-600 tabular-nums">
                    {product.stats.revenue != null
                      ? product.stats.revenueCurrency === "INR"
                        ? `₹${product.stats.revenue.toLocaleString("en-IN")}`
                        : `$${product.stats.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Marketplaces</span>
                  <span className="font-semibold text-slate-900">
                    {product.stats.marketplacesActive}{" "}
                    <span className="text-emerald-600 font-medium">active</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Listing Score</span>
                  <span className="font-semibold text-slate-900 inline-flex items-center gap-1 tabular-nums">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {listingRating}
                    {product.stats.listingScore > 0 && (
                      <span className="text-slate-400 font-normal">/ 5</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "workflow" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-900">{workflowTitle}</h2>
            <Button
              type="button"
              size="sm"
              className="h-7 text-[11px] bg-orange-500 hover:bg-orange-600"
              onClick={() => navigate(product.workflowUrl)}
            >
              Continue Workflow
            </Button>
          </div>
          <div className="space-y-2">
            {product.workflowSteps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-[11px]",
                  step.active && "border-orange-200 bg-orange-50/50",
                  step.completed && !step.active && "border-emerald-100 bg-emerald-50/30",
                  !step.active && !step.completed && "border-slate-100 bg-slate-50/50",
                )}
              >
                <span className="font-medium text-slate-800">
                  {step.id}. {step.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    step.completed && "text-emerald-600",
                    step.active && "text-orange-600",
                    !step.completed && !step.active && "text-slate-400",
                  )}
                >
                  {step.completed ? "Complete" : step.active ? "In progress" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "marketplaces" && (
        <ProductMarketplacesTab productId={product.id} source={resolvedSource} enabled={activeTab === "marketplaces"} />
      )}

      {activeTab === "orders" && (
        <ProductOrdersTab productId={product.id} source={resolvedSource} enabled={activeTab === "orders"} />
      )}

      {activeTab === "sales" && (
        <ProductSalesTab productId={product.id} source={resolvedSource} enabled={activeTab === "sales"} />
      )}

      <button
        type="button"
        onClick={() => navigate("/products")}
        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Products
      </button>
    </div>
  );
}
