import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  Link2,
  Package,
  Pencil,
  Sparkles,
  Star,
  Upload,
} from "lucide-react";
import { useGetAudit } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiFetchError, fetchJson } from "@/lib/api-fetch";
import { useBranding } from "@/hooks/use-branding";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  isBuildBrandAudit,
  mapAuditToProductDetail,
  type ProductDetailView,
} from "@/lib/product-mappers";
import { ProductOrdersTab } from "@/components/product-orders-tab";
import { ProductSalesTab } from "@/components/product-sales-tab";
import { ProductMarketplacesTab } from "@/components/product-marketplaces-tab";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type TabId = "overview" | "workflow" | "marketplaces" | "orders" | "sales";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "workflow", label: "Workflow" },
  { id: "marketplaces", label: "Marketplaces" },
  { id: "orders", label: "Orders" },
  { id: "sales", label: "Sales" },
];

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
  suggestions,
  workflowUrl,
  onNavigate,
}: {
  suggestions: string[];
  workflowUrl: string;
  onNavigate: (url: string) => void;
}) {
  const items = suggestions.length > 0
    ? suggestions
    : ["Complete your listing workflow to unlock personalized AI suggestions"];

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-orange-600" />
        <h2 className="text-xs font-semibold text-orange-900">AI Suggestions</h2>
      </div>
      <ul className="space-y-1.5 pl-4 list-disc marker:text-orange-400">
        {items.map((suggestion) => (
          <li key={suggestion} className="text-[11px] text-slate-800 leading-relaxed">
            {suggestion}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] bg-white border-orange-200 text-orange-900 hover:bg-orange-50"
          onClick={() => onNavigate(workflowUrl)}
        >
          Optimize content
          <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
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

export default function ProductDetailPage({ id }: { id: number }) {
  const { platformName } = useBranding();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { featureWorkspaceId } = useWorkspace();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [imageFailed, setImageFailed] = useState(false);

  const validId = !Number.isNaN(id) && id > 0;
  const queryEnabled = clerkLoaded && !!user && !!featureWorkspaceId && validId;

  const {
    data: apiProduct,
    isLoading: apiLoading,
    isError: apiError,
    error: apiErrorObj,
  } = useQuery({
    queryKey: ["product", id, featureWorkspaceId],
    queryFn: () => fetchJson<ProductDetailView>(`${basePath}/api/products/${id}`),
    enabled: queryEnabled,
    retry: false,
    staleTime: 10_000,
  });

  const {
    data: auditData,
    isLoading: auditLoading,
    isError: auditError,
  } = useGetAudit(id, {
    query: {
      enabled: queryEnabled,
      retry: 1,
    },
  });

  const product = useMemo((): ProductDetailView | null => {
    if (auditData && isBuildBrandAudit(auditData)) {
      const mapped = mapAuditToProductDetail(auditData);
      if (isValidProductDetail(apiProduct)) {
        return {
          ...mapped,
          ...apiProduct,
          manager: apiProduct.manager ?? mapped.manager,
          notes: apiProduct.notes || mapped.notes,
          referenceLinks: apiProduct.referenceLinks?.length
            ? apiProduct.referenceLinks
            : mapped.referenceLinks,
          aiSuggestions: apiProduct.aiSuggestions?.length
            ? apiProduct.aiSuggestions
            : mapped.aiSuggestions,
          priorityLabel: apiProduct.priorityLabel ?? mapped.priorityLabel,
          priorityLevel: apiProduct.priorityLevel ?? mapped.priorityLevel,
          driveFolderUrl: apiProduct.driveFolderUrl ?? mapped.driveFolderUrl,
        };
      }
      return mapped;
    }
    if (isValidProductDetail(apiProduct)) return apiProduct;
    return null;
  }, [apiProduct, auditData]);

  const isLoading = queryEnabled && (auditLoading || apiLoading) && !product;

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
              ? "The product detail API is not available yet. Deploy the latest API build, or open this product from Build Your Brand workflow."
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

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-[11px] text-slate-400 min-w-0">
          <Link href="/products" className="hover:text-slate-600 transition-colors shrink-0">
            {platformName}
          </Link>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <Link href="/products" className="hover:text-slate-600 transition-colors shrink-0">
            Products
          </Link>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="text-slate-600 truncate">{product.name}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] shrink-0"
          onClick={() => navigate(product.workflowUrl)}
        >
          <Pencil className="w-3 h-3 mr-1" />
          Edit in Workflow
        </Button>
      </div>

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
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{product.progressPercent}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all"
                style={{ width: `${product.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
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
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <h2 className="text-xs font-semibold text-slate-900">Product Details</h2>
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
              suggestions={product.aiSuggestions ?? []}
              workflowUrl={product.workflowUrl}
              onNavigate={navigate}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 flex-1 min-w-[120px] text-[11px] bg-white"
                onClick={() => navigate(product.workflowUrl)}
              >
                <Pencil className="w-3 h-3 mr-1.5" />
                Edit listing
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 flex-1 min-w-[120px] text-[11px] bg-white"
                onClick={() => navigate(product.workflowUrl)}
              >
                <Upload className="w-3 h-3 mr-1.5" />
                Push updates
              </Button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-semibold text-slate-900 mb-2">Notes</h2>
              <p className="text-[11px] text-slate-600 leading-relaxed">{product.notes}</p>
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
            <h2 className="text-xs font-semibold text-slate-900">Build Your Brand Workflow</h2>
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
        <ProductMarketplacesTab productId={product.id} enabled={activeTab === "marketplaces"} />
      )}

      {activeTab === "orders" && (
        <ProductOrdersTab productId={product.id} enabled={activeTab === "orders"} />
      )}

      {activeTab === "sales" && (
        <ProductSalesTab productId={product.id} enabled={activeTab === "sales"} />
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
