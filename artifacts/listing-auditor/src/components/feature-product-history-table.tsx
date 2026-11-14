import { useCallback, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Pencil,
  Upload,
  Download,
  Loader2,
  Package,
  Trash2,
  History,
  Search,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useActionDialog } from "@/components/ui/action-dialog";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceScopeLoading } from "@/hooks/use-workspace-scope-loading";
import { canExportListingSource } from "@/components/listing-export-button";
import { downloadAuditExport } from "@/lib/amazon-export";
import { fetchWorkspaceProducts } from "@/lib/account-recents-fetch";
import { getGetRecentsQueryKey } from "@workspace/api-client-react";
import type { WorkspaceFeature } from "@workspace/workspace-permissions";
import {
  auditListingDetailViewPath,
  AUDIT_IN_DETAIL_FROM,
  type AuditListingDetailOpenFrom,
} from "@/lib/audit-in-detail-nav";
import {
  graphicsInDetailViewPath,
  GRAPHICS_IN_DETAIL_FROM,
} from "@/lib/graphics-in-detail-nav";
import { ensureGraphicsProjectForAudit } from "@/lib/ensure-graphics-project-for-audit";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ProductSourceType = "listing" | "audit" | "graphics" | "video" | "ads";

interface ProductListItem {
  id: number;
  name: string;
  sku: string;
  imageUrl: string | null;
  channels: string[];
  price: number | null;
  currency: string;
  stock: number | null;
  inStock?: boolean | null;
  sourceType: ProductSourceType;
  sourceTypeLabel: string;
  detailUrl: string;
  workflowUrl?: string;
  isShopifyImport?: boolean;
  auditScore?: number | null;
  auditPending?: boolean;
  workspaceId?: number | null;
  updatedAt?: string;
}

const SOURCE_TYPE_LABELS: Record<ProductSourceType, string> = {
  listing: "Build Your Brand",
  audit: "Audit Listing",
  graphics: "Create Graphics",
  video: "Create Video",
  ads: "Manage Ads",
};

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("http://")
    || trimmed.startsWith("https://")
    || trimmed.startsWith("data:")
    || trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${basePath}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

function inferSourceType(workflowUrl: string): ProductSourceType {
  if (/^\/audits\/\d+$/.test(workflowUrl)) return "audit";
  if (workflowUrl.startsWith("/projects/")) return "graphics";
  if (workflowUrl.startsWith("/videos/")) return "video";
  if (workflowUrl.startsWith("/ads/")) return "ads";
  return "listing";
}

function productDetailUrl(id: number, sourceType: ProductSourceType): string {
  return `/products/${id}?source=${sourceType}&step=overview`;
}

function productKey(product: ProductListItem): string {
  return `${product.sourceType}-${product.id}`;
}

function matchesHistorySearch(product: ProductListItem, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    product.name,
    product.sku,
    product.sourceTypeLabel,
    ...(product.channels ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function resolveProductViewUrl(
  product: ProductListItem,
  viewTarget: "default" | "audit-detail" | "graphics-detail",
  auditDetailFrom: AuditListingDetailOpenFrom,
): string {
  if (viewTarget === "audit-detail" && product.sourceType === "audit") {
    return auditListingDetailViewPath(product.id, auditDetailFrom, "overview");
  }
  if (viewTarget === "graphics-detail" && product.sourceType === "graphics") {
    return graphicsInDetailViewPath(product.id, "overview");
  }
  if (
    viewTarget === "graphics-detail"
    && product.sourceType === "listing"
    && product.sourceTypeLabel === "Create Graphics"
  ) {
    return product.workflowUrl || product.detailUrl;
  }
  if (product.sourceType === "graphics") {
    return product.workflowUrl?.includes("from=graphics-in-detail")
      ? product.workflowUrl
      : graphicsInDetailViewPath(product.id, "overview");
  }
  if (product.sourceType === "video") {
    return product.workflowUrl || product.detailUrl;
  }
  return product.detailUrl;
}

function resolveProductEditUrl(product: ProductListItem, viewUrl: string): string {
  if (product.sourceType === "graphics" || product.sourceType === "video") {
    return product.workflowUrl || viewUrl;
  }
  return productOverviewEditUrl(viewUrl);
}

function productOverviewEditUrl(detailUrl: string): string {
  const separator = detailUrl.includes("?") ? "&" : "?";
  return `${detailUrl}${separator}step=overview&edit=listing`;
}

function normalizeApiProduct(raw: ProductListItem & Partial<ProductListItem>): ProductListItem {
  const workflowUrl = raw.workflowUrl ?? `/audits/workflow?resume=${raw.id}`;
  const isShopifyImport = raw.isShopifyImport === true;
  const sourceType = isShopifyImport
    ? "listing"
    : (raw.sourceType ?? inferSourceType(workflowUrl));
  const detailUrl = raw.detailUrl ?? productDetailUrl(raw.id, sourceType);
  const auditScore = raw.auditScore != null && raw.auditScore > 0 ? raw.auditScore : null;

  return {
    ...raw,
    workflowUrl,
    sourceType,
    sourceTypeLabel: isShopifyImport
      ? "Shopify Import"
      : (raw.sourceTypeLabel ?? SOURCE_TYPE_LABELS[sourceType]),
    detailUrl: isShopifyImport ? productDetailUrl(raw.id, "listing") : detailUrl,
    auditScore,
    auditPending: raw.auditPending ?? auditScore == null,
    inStock: raw.inStock ?? null,
    stock: raw.stock ?? null,
  };
}

function formatPrice(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatStock(stock: number | null, inStock?: boolean | null): string {
  if (stock != null) return stock.toLocaleString("en-IN");
  if (inStock === true) return "In stock";
  if (inStock === false) return "Out of stock";
  return "—";
}

function formatAuditScore(score: number | null | undefined, pending?: boolean): string {
  if (score != null && score > 0) return `${score}`;
  if (pending) return "Pending";
  return "—";
}

function auditScoreBadgeClass(score: number | null | undefined, pending?: boolean): string {
  if (score != null && score > 0) {
    if (score >= 70) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 50) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-red-50 text-red-600 border-red-200";
  }
  if (pending) return "bg-muted text-muted-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
}

function canExportListingProduct(product: ProductListItem): boolean {
  return canExportListingSource(product.sourceType);
}

function productDeleteFeature(sourceType: ProductSourceType): WorkspaceFeature {
  switch (sourceType) {
    case "listing":
      return "build_brand";
    case "audit":
      return "audits";
    case "graphics":
      return "graphics";
    case "video":
      return "videos";
    case "ads":
      return "ads";
    default:
      return "build_brand";
  }
}

function ProductThumb({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl && !failed ? resolveImageUrl(imageUrl) : null;

  if (src) {
    return (
      <div className="w-7 h-7 rounded-md overflow-hidden bg-slate-100 flex-shrink-0 border border-border">
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center flex-shrink-0">
      <Package className="w-3.5 h-3.5 text-muted-foreground" />
    </div>
  );
}

function ChannelTags({ channels }: { channels: string[] }) {
  if (channels.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {channels.map((ch) => (
        <span
          key={ch}
          className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-card text-[10px] font-medium text-muted-foreground"
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

function ProductActions({
  product,
  viewUrl,
  editUrl,
  viewTooltip,
  openTooltip,
  rowKey,
  exportingKey,
  canDelete,
  deletePending,
  onNavigate,
  onExport,
  onDelete,
  compact,
}: {
  product: ProductListItem;
  viewUrl: string;
  editUrl: string;
  viewTooltip: string;
  openTooltip: string;
  rowKey: string;
  exportingKey: string | null;
  canDelete: boolean;
  deletePending: boolean;
  onNavigate: (url: string) => void;
  onExport: (product: ProductListItem) => void;
  onDelete: (products: ProductListItem[]) => void;
  compact?: boolean;
}) {
  const btnClass = compact ? "w-9 h-9" : "w-7 h-7";

  return (
    <div className={cn("flex items-center gap-1", compact ? "flex-wrap" : "justify-end")}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onNavigate(viewUrl)}
            className={cn(btnClass, "inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground/90 hover:bg-muted transition-colors")}
            aria-label="View product"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{viewTooltip}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onNavigate(editUrl)}
            className={cn(btnClass, "inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground/90 hover:bg-muted transition-colors")}
            aria-label="Edit overview"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Edit overview summary</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onNavigate(viewUrl)}
            className={cn(btnClass, "inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground/90 hover:bg-muted transition-colors")}
            aria-label="Open product"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{openTooltip}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={exportingKey === rowKey || !canExportListingProduct(product)}
            onClick={() => void onExport(product)}
            className={cn(
              btnClass,
              "inline-flex items-center justify-center rounded-md border border-border bg-card transition-colors disabled:opacity-50",
              canExportListingProduct(product)
                ? "text-muted-foreground hover:text-foreground/90 hover:bg-muted"
                : "text-muted-foreground/40 cursor-not-allowed",
            )}
            aria-label="Export listing Excel"
          >
            {exportingKey === rowKey ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {canExportListingProduct(product)
            ? "Export Amazon listing (Excel)"
            : "Export available for listing audits only"}
        </TooltipContent>
      </Tooltip>
      {canDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={deletePending}
              onClick={() => onDelete([product])}
              className={cn(btnClass, "inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50")}
              aria-label="Delete product"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Delete</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function productActionTooltips(sourceType: ProductSourceType): {
  view: string;
  open: string;
} {
  if (sourceType === "graphics") {
    return {
      view: "Open overview & graphics tabs",
      open: "Open Graphics in Detail",
    };
  }
  if (sourceType === "video") {
    return {
      view: "View video project",
      open: "Open video project",
    };
  }
  return {
    view: "View in Product Explorer",
    open: "Open in Product Explorer",
  };
}

export type FeatureProductHistorySource = "audit" | "graphics";

export function FeatureProductHistoryTable({
  sourceType,
  sectionTitle,
  emptyTitle,
  emptyDescription,
  viewTarget = "default",
  auditDetailFrom = AUDIT_IN_DETAIL_FROM,
  graphicsDetailFrom: _graphicsDetailFrom = GRAPHICS_IN_DETAIL_FROM,
  includeAuditListingsInGraphicsHistory = false,
}: {
  sourceType: FeatureProductHistorySource;
  sectionTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Open audit rows on `/audits/:id` (overview + audit result tabs) instead of Product Explorer. */
  viewTarget?: "default" | "audit-detail" | "graphics-detail";
  auditDetailFrom?: AuditListingDetailOpenFrom;
  graphicsDetailFrom?: typeof GRAPHICS_IN_DETAIL_FROM;
  /** When viewing graphics history, also list audit listings and open them in Graphics in Detail (Overview tab). */
  includeAuditListingsInGraphicsHistory?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { isLoaded: clerkLoaded, user } = useUser();
  const {
    featureWorkspaceId,
    isLoading: wsLoading,
    needsWorkspaceSelection,
    canDelete,
  } = useWorkspace();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const { trigger: triggerDeleteDialog, dialog: deleteDialog } = useActionDialog();

  const productsQueryScope = featureWorkspaceId;
  const productsQueryEnabled = clerkLoaded && !!user && !!featureWorkspaceId;
  const { data: apiData, isLoading, isError, isFetching } = useQuery({
    queryKey: ["products", productsQueryScope, "feature-history", sourceType],
    queryFn: () => fetchWorkspaceProducts(),
    enabled: productsQueryEnabled,
    staleTime: 10_000,
    refetchOnMount: "always",
    retry: 1,
  });
  const scopeLoading = useWorkspaceScopeLoading(productsQueryScope, {
    isFetching,
    isLoading,
    isEnabled: productsQueryEnabled,
  });

  const sourceProducts = useMemo(() => {
    const raw = (apiData?.products ?? []) as ProductListItem[];
    const normalized = raw.map((p) => normalizeApiProduct(p));
    if (sourceType === "graphics" && includeAuditListingsInGraphicsHistory) {
      const graphics = normalized.filter((p) => p.sourceType === "graphics");
      const audits = normalized.filter((p) => p.sourceType === "audit");
      const graphicsInExplorer = normalized.filter(
        (p) => p.sourceType === "listing" && p.sourceTypeLabel === "Create Graphics",
      );
      return [...graphics, ...audits, ...graphicsInExplorer].sort(
        (a, b) =>
          new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
      );
    }
    return normalized.filter((p) => p.sourceType === sourceType);
  }, [apiData?.products, sourceType, includeAuditListingsInGraphicsHistory]);

  const products = useMemo(
    () => sourceProducts.filter((p) => matchesHistorySearch(p, searchQuery)),
    [sourceProducts, searchQuery],
  );

  const searchActive = searchQuery.trim().length > 0;

  const canDeleteProduct = (product: ProductListItem) =>
    canDelete(productDeleteFeature(product.sourceType));

  const [openingGraphicsKey, setOpeningGraphicsKey] = useState<string | null>(null);

  const openHistoryProduct = useCallback(
    async (product: ProductListItem) => {
      const key = productKey(product);
      if (
        viewTarget === "graphics-detail"
        && sourceType === "graphics"
        && product.sourceType === "audit"
      ) {
        setOpeningGraphicsKey(key);
        try {
          const projectId = await ensureGraphicsProjectForAudit(product.id);
          navigate(graphicsInDetailViewPath(projectId, "overview"));
        } catch (error) {
          toast({
            title: "Could not open graphics project",
            description: error instanceof Error ? error.message : "Try again from Create Graphics.",
            variant: "destructive",
          });
        } finally {
          setOpeningGraphicsKey(null);
        }
        return;
      }
      navigate(resolveProductViewUrl(product, viewTarget, auditDetailFrom));
    },
    [auditDetailFrom, navigate, sourceType, toast, viewTarget],
  );

  const deleteProductsMutation = useMutation({
    mutationFn: async (items: Array<{ type: ProductSourceType; id: number; workspaceId?: number }>) => {
      await Promise.all(items.map(async ({ type, id, workspaceId }) => {
        const headers: HeadersInit = {};
        if (workspaceId != null) {
          headers["X-Workspace-Id"] = String(workspaceId);
        }
        const response = await fetch(`${basePath}/api/projects/${type}/${id}`, {
          method: "DELETE",
          credentials: "include",
          headers,
        });
        if (!response.ok) {
          throw new Error(`Failed to delete product #${id}`);
        }
      }));
    },
    onSuccess: (_data, items) => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: getGetRecentsQueryKey({ limit: 500 }) });
      setSelected((prev) => {
        const next = new Set(prev);
        for (const item of items) {
          next.delete(`${item.type}-${item.id}`);
        }
        return next;
      });
    },
  });

  async function handleExportProduct(product: ProductListItem) {
    if (!canExportListingProduct(product)) {
      toast({
        title: "Export not available",
        description: "Excel export is available for Build Your Brand and Audit Listing products.",
        variant: "destructive",
      });
      return;
    }

    const key = productKey(product);
    setExportingKey(key);
    try {
      await downloadAuditExport({
        auditId: product.id,
        format: "excel",
        platform: "amazon",
        marketplace: "US",
        basePath,
      });
      toast({
        title: "Export downloaded",
        description: `Amazon listing Excel for ${product.name}.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export this product.",
        variant: "destructive",
      });
    } finally {
      setExportingKey(null);
    }
  }

  function requestDeleteProducts(productsToDelete: ProductListItem[]) {
    const deletable = productsToDelete.filter(canDeleteProduct);
    if (deletable.length === 0) {
      toast({
        title: "No permission",
        description: "You do not have permission to delete the selected products.",
        variant: "destructive",
      });
      return;
    }

    const count = deletable.length;
    triggerDeleteDialog(
      async () => {
        await deleteProductsMutation.mutateAsync(
          deletable.map((product) => ({
            type: product.sourceType,
            id: product.id,
            workspaceId: product.workspaceId ?? undefined,
          })),
        );
      },
      {
        title: count === 1 ? "Delete product?" : `Delete ${count} products?`,
        description: count === 1
          ? `"${deletable[0]!.name}" will be permanently deleted. This cannot be undone.`
          : `${count} selected listings will be permanently deleted. This cannot be undone.`,
        confirmLabel: "Delete",
        confirmVariant: "destructive",
        successTitle: "Deleted",
        successDescription: count === 1 ? "Product removed." : `${count} products removed.`,
      },
    );
  }

  const allSelected = products.length > 0 && products.every((p) => selected.has(productKey(p)));
  const selectedCount = products.filter((p) => selected.has(productKey(p))).length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => productKey(p))));
    }
  };

  const toggleOne = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (wsLoading || scopeLoading || (isLoading && productsQueryEnabled)) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-orange-500" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full min-w-0 rounded-xl border border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        Could not load history. Refresh the page to try again.
      </div>
    );
  }

  if (!featureWorkspaceId || needsWorkspaceSelection) {
    return (
      <div className="w-full min-w-0 rounded-xl border border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        Select a workspace to see your history in Product Explorer format.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <History className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {sectionTitle}
          </h2>
        </div>
        {sourceProducts.length > 0 ? (
          <div className="relative w-full sm:max-w-sm sm:ml-auto">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name or SKU…"
              className="h-9 pl-9 text-sm"
              aria-label="Search projects"
            />
          </div>
        ) : null}
      </div>

      <div className="md:hidden rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {sourceProducts.length === 0 ? (
          <div className="py-10 px-6 text-center">
            <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{emptyDescription}</p>
          </div>
        ) : products.length === 0 && searchActive ? (
          <div className="py-10 px-6 text-center">
            <p className="text-sm font-medium text-foreground">No matches</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Nothing matches &ldquo;{searchQuery.trim()}&rdquo;. Try another name or SKU.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {products.map((product) => {
              const key = productKey(product);
              const viewUrl = resolveProductViewUrl(product, viewTarget, auditDetailFrom);
              const editUrl = resolveProductEditUrl(product, viewUrl);
              const tooltips = productActionTooltips(product.sourceType);
              return (
                <li key={key}>
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => void openHistoryProduct(product)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void openHistoryProduct(product);
                      }
                    }}
                    className="p-4 space-y-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(key)}
                          onCheckedChange={() => toggleOne(key)}
                          aria-label={`Select ${product.name}`}
                          className="h-4 w-4 mt-1"
                        />
                      </div>
                      <ProductThumb imageUrl={product.imageUrl} name={product.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">{product.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5 break-all">
                          {product.sku || "No SKU"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border tabular-nums shrink-0",
                          auditScoreBadgeClass(product.auditScore, product.auditPending),
                        )}
                      >
                        {formatAuditScore(product.auditScore, product.auditPending)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-10">
                      <ChannelTags channels={product.channels} />
                    </div>
                    <div
                      className="pl-10 pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ProductActions
                        product={product}
                        viewUrl={viewUrl}
                        editUrl={editUrl}
                        viewTooltip={tooltips.view}
                        openTooltip={tooltips.open}
                        rowKey={key}
                        exportingKey={exportingKey}
                        canDelete={canDeleteProduct(product)}
                        deletePending={deleteProductsMutation.isPending}
                        onNavigate={(url) => {
                          if (viewTarget === "graphics-detail" && sourceType === "graphics") {
                            void openHistoryProduct(product);
                            return;
                          }
                          navigate(url);
                        }}
                        onExport={handleExportProduct}
                        onDelete={requestDeleteProducts}
                        compact
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/80">
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                    className="h-3.5 w-3.5"
                  />
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Product</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Audit Score</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">SKU</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Channels</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Price</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stock</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sourceProducts.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="py-10 px-6 text-center">
                      <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 && searchActive ? (
                <tr>
                  <td colSpan={8}>
                    <div className="py-10 px-6 text-center">
                      <p className="text-sm font-medium text-foreground">No matches</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                        Nothing matches &ldquo;{searchQuery.trim()}&rdquo;. Try another name or SKU.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const key = productKey(product);
                  const viewUrl = resolveProductViewUrl(product, viewTarget, auditDetailFrom);
                  const editUrl = resolveProductEditUrl(product, viewUrl);
                  const tooltips = productActionTooltips(product.sourceType);
                  return (
                    <tr
                      key={key}
                      role="link"
                      tabIndex={0}
                      onClick={() => void openHistoryProduct(product)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void openHistoryProduct(product);
                        }
                      }}
                      className={cn(
                        "border-b border-border/60 last:border-0 hover:bg-muted/60 transition-colors cursor-pointer",
                        openingGraphicsKey === key && "opacity-70",
                      )}
                    >
                      <td className="px-3 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(key)}
                          onCheckedChange={() => toggleOne(key)}
                          aria-label={`Select ${product.name}`}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center gap-2 min-w-0">
                          <ProductThumb imageUrl={product.imageUrl} name={product.name} />
                          <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border tabular-nums",
                            auditScoreBadgeClass(product.auditScore, product.auditPending),
                          )}
                        >
                          {formatAuditScore(product.auditScore, product.auditPending)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="text-[11px] font-mono text-muted-foreground">{product.sku || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <ChannelTags channels={product.channels} />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="text-xs font-semibold text-foreground tabular-nums">
                          {formatPrice(product.price, product.currency)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatStock(product.stock, product.inStock)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
                        <ProductActions
                          product={product}
                          viewUrl={viewUrl}
                          editUrl={editUrl}
                          viewTooltip={tooltips.view}
                          openTooltip={tooltips.open}
                          rowKey={key}
                          exportingKey={exportingKey}
                          canDelete={canDeleteProduct(product)}
                          deletePending={deleteProductsMutation.isPending}
                          onNavigate={(url) => {
                            if (viewTarget === "graphics-detail" && sourceType === "graphics") {
                              void openHistoryProduct(product);
                              return;
                            }
                            navigate(url);
                          }}
                          onExport={handleExportProduct}
                          onDelete={requestDeleteProducts}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sourceProducts.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-right">
          {searchActive
            ? `${products.length} of ${sourceProducts.length} shown`
            : `${products.length} product${products.length === 1 ? "" : "s"}`}
          {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
        </p>
      )}
      {deleteDialog}
    </div>
  );
}
