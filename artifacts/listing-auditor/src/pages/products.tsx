import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Upload,
  FileInput,
  Loader2,
  Package,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { useActionDialog } from "@/components/ui/action-dialog";
import { downloadProductImportTemplate, parseProductsCsv } from "@/lib/product-import";
import { useBranding } from "@/hooks/use-branding";
import { useWorkspace } from "@/hooks/use-workspace";
import { WORKSPACES_HUB_LABEL } from "@/lib/workspaces-hub";
import { useGetRecents, getGetRecentsQueryKey } from "@workspace/api-client-react";
import type { RecentItem } from "@workspace/api-client-react";
import { useTeam } from "@/hooks/use-team";
import type { WorkspaceFeature } from "@workspace/workspace-permissions";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ChannelFilter = "all" | "amazon" | "shopify" | "woocommerce";

const CHANNEL_FILTER_LABELS: Record<Exclude<ChannelFilter, "all">, string> = {
  amazon: "Amazon",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
};

type ProductStatus = "active" | "in_progress" | "draft" | "failed";

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
  status: ProductStatus;
  statusLabel: string;
  workflowUrl: string;
  detailUrl: string;
  sourceType: ProductSourceType;
  sourceTypeLabel: string;
}

interface ProductsResponse {
  products: ProductListItem[];
}

const CHANNEL_FILTERS: Array<{ id: ChannelFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "amazon", label: "Amazon" },
  { id: "shopify", label: "Shopify" },
  { id: "woocommerce", label: "WooCommerce" },
];

const SOURCE_TYPE_LABELS: Record<ProductSourceType, string> = {
  listing: "Build Your Brand",
  audit: "Audit Listing",
  graphics: "Create Graphics",
  video: "Create Video",
  ads: "Manage Ads",
};

const SKU_PREFIX_BY_SOURCE: Partial<Record<ProductSourceType, string>> = {
  audit: "AUD",
  graphics: "GFX",
  video: "VID",
  ads: "ADS",
};

const RECENT_PRODUCT_TYPES = new Set<ProductSourceType | "video">([
  "listing",
  "audit",
  "graphics",
  "video",
  "ads",
]);

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

function deriveSku(productName: string, id: number, skuPrefix?: string): string {
  if (skuPrefix) return `${skuPrefix}-${String(id).padStart(4, "0")}`;
  const parts = productName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.slice(0, 3).toUpperCase());
  const prefix = parts.join("-") || "PRD";
  return `${prefix}-${String(id).padStart(4, "0")}`;
}

function productKey(product: ProductListItem): string {
  return `${product.sourceType}-${product.id}`;
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

function inferSourceType(workflowUrl: string): ProductSourceType {
  if (/^\/audits\/\d+$/.test(workflowUrl)) return "audit";
  if (workflowUrl.startsWith("/projects/")) return "graphics";
  if (workflowUrl.startsWith("/videos/")) return "video";
  if (workflowUrl.startsWith("/ads/")) return "ads";
  return "listing";
}

function productDetailUrl(id: number, sourceType: ProductSourceType): string {
  return `/products/${id}?source=${sourceType}`;
}

function normalizeApiProduct(raw: ProductListItem & Partial<ProductListItem>): ProductListItem {
  const workflowUrl = raw.workflowUrl ?? `/audits/workflow?resume=${raw.id}`;
  const sourceType = raw.sourceType ?? inferSourceType(workflowUrl);
  const detailUrl = raw.detailUrl ?? productDetailUrl(raw.id, sourceType);

  return {
    ...raw,
    workflowUrl,
    sourceType,
    sourceTypeLabel: raw.sourceTypeLabel ?? SOURCE_TYPE_LABELS[sourceType],
    detailUrl,
  };
}

function mergeProductLists(apiProducts: ProductListItem[], recentProducts: ProductListItem[]): ProductListItem[] {
  const merged = new Map<number, ProductListItem>();
  const order: number[] = [];

  for (const product of apiProducts) {
    if (!merged.has(product.id)) order.push(product.id);
    merged.set(product.id, product);
  }
  for (const product of recentProducts) {
    if (!merged.has(product.id)) {
      merged.set(product.id, product);
      order.push(product.id);
    }
  }

  return order.map((id) => merged.get(id)!);
}

function mapRecentToProduct(item: RecentItem): ProductListItem {
  const score = item.score ?? null;
  const sourceType = (item.type === "video" ? "video" : item.type) as ProductSourceType;
  const typeLabel = (item as RecentItem & { typeLabel?: string }).typeLabel;
  const detailUrl = productDetailUrl(item.id, sourceType);

  return {
    id: item.id,
    name: item.name,
    sku: deriveSku(item.name, item.id, SKU_PREFIX_BY_SOURCE[sourceType]),
    imageUrl: item.imageUrl ?? null,
    channels: [],
    price: null,
    currency: "INR",
    stock: null,
    status: score != null && score > 0 ? "active" : "in_progress",
    statusLabel: score != null && score > 0 ? "Active" : "In progress",
    workflowUrl: item.url,
    detailUrl,
    sourceType,
    sourceTypeLabel: typeLabel ?? SOURCE_TYPE_LABELS[sourceType],
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

function statusBadgeClass(status: ProductStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "in_progress":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "failed":
      return "bg-red-50 text-red-600 border-red-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function ProductThumb({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl && !failed ? resolveImageUrl(imageUrl) : null;

  if (src) {
    return (
      <div className="w-7 h-7 rounded-md overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
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
    <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
      <Package className="w-3.5 h-3.5 text-slate-400" />
    </div>
  );
}

function ChannelTags({ channels }: { channels: string[] }) {
  if (channels.length === 0) {
    return <span className="text-[11px] text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {channels.map((ch) => (
        <span
          key={ch}
          className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-medium text-slate-600"
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

export default function ProductsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement>(null);
  const { platformName } = useBranding();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { isTeamMember } = useTeam();
  const { featureWorkspaceId, isLoading: wsLoading, needsWorkspaceSelection, canEdit, isAccountOwner, canDelete } = useWorkspace();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { trigger: triggerDeleteDialog, dialog: deleteDialog } = useActionDialog();

  const recentsScope = `${isTeamMember ? "member" : "owner"}-ws-${featureWorkspaceId ?? "none"}`;

  const { data: apiData, isLoading: apiLoading } = useQuery({
    queryKey: ["products", featureWorkspaceId],
    queryFn: () => fetchJson<ProductsResponse>(`${basePath}/api/products`),
    enabled: clerkLoaded && !!user && !!featureWorkspaceId,
    staleTime: 10_000,
    refetchOnMount: "always",
    retry: 1,
  });

  const { data: recentsData, isLoading: recentsLoading } = useGetRecents(
    { limit: 500 },
    {
      query: {
        queryKey: [...getGetRecentsQueryKey({ limit: 500 }), recentsScope],
        staleTime: 10_000,
        enabled: clerkLoaded && !!user && !!featureWorkspaceId,
        refetchOnMount: "always",
      },
    },
  );

  const products = useMemo(() => {
    const fromApi = (apiData?.products ?? []).map(normalizeApiProduct);
    const fromRecents = (recentsData?.items ?? [])
      .filter((item) => RECENT_PRODUCT_TYPES.has(item.type as ProductSourceType))
      .map(mapRecentToProduct);

    return mergeProductLists(fromApi, fromRecents);
  }, [apiData, recentsData]);

  const isLoading = apiLoading || recentsLoading;

  const canImportProducts = canEdit("build_brand") || canEdit("audits");

  const canDeleteProduct = (product: ProductListItem) =>
    isAccountOwner || canDelete(productDeleteFeature(product.sourceType));

  const deleteProductsMutation = useMutation({
    mutationFn: async (items: Array<{ type: ProductSourceType; id: number }>) => {
      await Promise.all(items.map(async ({ type, id }) => {
        const response = await fetch(`${basePath}/api/projects/${type}/${id}`, {
          method: "DELETE",
          credentials: "include",
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
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete product(s).",
        variant: "destructive",
      });
    },
  });

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
          deletable.map((product) => ({ type: product.sourceType, id: product.id })),
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

  const importProductsMutation = useMutation({
    mutationFn: (products: ReturnType<typeof parseProductsCsv>) =>
      fetchJson<{ imported: Array<{ id: number; name: string; sku: string }>; errors: Array<{ row: number; error: string }> }>(
        `${basePath}/api/products/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products }),
        },
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: getGetRecentsQueryKey({ limit: 500 }) });

      if (result.imported.length > 0) {
        toast({
          title: "Import complete",
          description: `${result.imported.length} product${result.imported.length === 1 ? "" : "s"} imported.`,
        });
      }

      if (result.errors.length > 0) {
        toast({
          title: "Some rows failed",
          description: result.errors.map((e) => `Row ${e.row}: ${e.error}`).join(" "),
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import products.",
        variant: "destructive",
      });
    },
  });

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const products = parseProductsCsv(text);
      importProductsMutation.mutate(products);
    } catch (error) {
      toast({
        title: "Invalid CSV",
        description: error instanceof Error ? error.message : "Could not read the CSV file.",
        variant: "destructive",
      });
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (channelFilter !== "all") {
        const label = CHANNEL_FILTER_LABELS[channelFilter];
        if (!p.channels.some((c) => c.toLowerCase() === label.toLowerCase())) return false;
      }
      return true;
    });
  }, [products, search, channelFilter]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(productKey(p)));
  const selectedProducts = useMemo(
    () => filtered.filter((product) => selected.has(productKey(product))),
    [filtered, selected],
  );
  const selectedCount = selectedProducts.length;
  const selectedDeletableCount = selectedProducts.filter(canDeleteProduct).length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => productKey(p))));
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

  if (wsLoading || (isLoading && featureWorkspaceId)) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!featureWorkspaceId || needsWorkspaceSelection) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Package className="w-10 h-10 text-slate-300 mb-3" />
        <h2 className="text-base font-semibold text-slate-900">Select a workspace</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-md">
          Products are scoped to a workspace. Choose one in the top bar, or create a workspace from {WORKSPACES_HUB_LABEL}.
        </p>
        <Button asChild size="sm" className="mt-5 bg-orange-500 hover:bg-orange-600 text-xs h-8">
          <Link href="/workspaces">{WORKSPACES_HUB_LABEL}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        <span>{platformName}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600">Products</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Products</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-xl sm:justify-end">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, orders..."
              className="h-8 pl-8 text-xs border-slate-200 bg-white rounded-lg"
            />
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 text-xs font-medium border-slate-300 text-slate-800 shrink-0 rounded-lg px-3"
          >
            <Link href="/audits/new">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Channel filters + Import */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {CHANNEL_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setChannelFilter(id)}
              className={cn(
                "h-7 px-3 rounded-full text-[11px] font-medium border transition-colors",
                channelFilter === id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImportFile(file);
              event.target.value = "";
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canImportProducts || importProductsMutation.isPending}
                className="h-7 text-[11px] font-medium border-slate-200 text-slate-600 rounded-lg px-2.5 gap-1.5"
                onClick={() => importInputRef.current?.click()}
              >
                {importProductsMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileInput className="w-3.5 h-3.5" />
                )}
                Import
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-xs">
              Upload a CSV with productName, sku, and optional marketplace columns.
              {" "}
              <button
                type="button"
                className="underline text-orange-600 hover:text-orange-700"
                onClick={(event) => {
                  event.preventDefault();
                  downloadProductImportTemplate();
                }}
              >
                Download template
              </button>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50/80 px-3 py-2">
          <p className="text-xs font-medium text-orange-900">
            {selectedCount} listing{selectedCount === 1 ? "" : "s"} selected
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-orange-200 bg-white text-slate-700"
              onClick={() => setSelected(new Set())}
            >
              Clear selection
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 text-[11px]"
              disabled={selectedDeletableCount === 0 || deleteProductsMutation.isPending}
              onClick={() => requestDeleteProducts(selectedProducts)}
            >
              {deleteProductsMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1" />
              )}
              Delete selected
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="w-10 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all products"
                      className="h-3.5 w-3.5"
                    />
                    {selectedCount > 0 && (
                      <span className="text-[10px] font-semibold text-orange-600 tabular-nums">
                        {selectedCount}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Product</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">SKU</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Channels</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Price</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stock</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-700">No products yet</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      Projects from Build Your Brand, Audit Listing, Create Graphics, Create Video, and Manage Ads appear here automatically.
                    </p>
                    <Button
                      asChild
                      size="sm"
                      className="mt-4 h-7 text-xs bg-orange-500 hover:bg-orange-600"
                    >
                      <Link href="/audits/new">
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Product
                      </Link>
                    </Button>
                  </td>
                </tr>
              ) : (
                filtered.map((product) => {
                  const key = productKey(product);
                  return (
                  <tr
                    key={key}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-3 py-2.5 align-middle">
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
                        <span className="text-xs font-medium text-slate-900 truncate max-w-[200px]">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                        {product.sourceTypeLabel || SOURCE_TYPE_LABELS[product.sourceType] || "Project"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className="text-[11px] font-mono text-slate-500">{product.sku}</span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChannelTags channels={product.channels} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className="text-xs font-semibold text-slate-900 tabular-nums">
                        {formatPrice(product.price, product.currency)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className="text-xs text-slate-600 tabular-nums">
                        {formatStock(product.stock, product.inStock)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
                          statusBadgeClass(product.status),
                        )}
                      >
                        {product.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => navigate(`/products/${product.id}?source=${product.sourceType}`)}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                              aria-label="View product"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">View</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => navigate(product.workflowUrl)}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                              aria-label="Edit product"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => navigate(product.workflowUrl)}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                              aria-label="Export product"
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Export</TooltipContent>
                        </Tooltip>
                        {canDeleteProduct(product) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                disabled={deleteProductsMutation.isPending}
                                onClick={() => requestDeleteProducts([product])}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                                aria-label="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Delete</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <p className="text-[10px] text-slate-400 text-right">
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
          {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
          {channelFilter !== "all" ? ` · filtered by ${CHANNEL_FILTER_LABELS[channelFilter]}` : ""}
        </p>
      )}
      {deleteDialog}
    </div>
  );
}
