import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, PackageSearch, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ProductStatus = "active" | "in_progress" | "draft" | "failed";

interface ProductListItem {
  id: number;
  name: string;
  sku: string;
  imageUrl: string | null;
  category?: string | null;
  status: ProductStatus;
  statusLabel: string;
  sourceType?: string;
  workflowUrl?: string;
}

interface ProductsResponse {
  products: ProductListItem[];
}

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

function statusBadgeClass(status: ProductStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "in_progress":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

interface BuildBrandProductSearchProps {
  selectedProductId: number | null;
  onSelectProduct: (productId: number | null) => void;
  onSkipToUpload: () => void;
}

export function BuildBrandProductSearch({
  selectedProductId,
  onSelectProduct,
  onSkipToUpload,
}: BuildBrandProductSearchProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ProductStatus>("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<"" | ProductStatus>("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products", "build-brand-select"],
    queryFn: () => fetchJson<ProductsResponse>(`${basePath}/api/products`),
    staleTime: 30_000,
  });

  const listingProducts = useMemo(() => {
    return (data?.products ?? []).filter((p) => {
      const source = p.sourceType ?? "listing";
      return source === "listing" || (p.workflowUrl ?? "").includes("/audits/workflow");
    });
  }, [data?.products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of listingProducts) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listingProducts]);

  const filteredProducts = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    return listingProducts.filter((p) => {
      if (appliedCategory && (p.category ?? "").trim() !== appliedCategory) return false;
      if (appliedStatus && p.status !== appliedStatus) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q)
        || p.sku.toLowerCase().includes(q)
        || (p.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [listingProducts, appliedQuery, appliedCategory, appliedStatus]);

  function handleSearch() {
    setAppliedQuery(query);
    setAppliedCategory(categoryFilter);
    setAppliedStatus(statusFilter);
  }

  function handleReset() {
    setQuery("");
    setCategoryFilter("");
    setStatusFilter("");
    setAppliedQuery("");
    setAppliedCategory("");
    setAppliedStatus("");
    onSelectProduct(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
          <PackageSearch className="w-4 h-4 text-orange-500" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Select Existing Product</h2>
          <p className="text-xs text-slate-500">
            Search your workspace for a Build Your Brand project, or continue to upload a new product
          </p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Search by name, SKU, or category…"
              className="pl-9 border-slate-200 rounded-xl h-11"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 min-w-[10rem]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | ProductStatus)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 min-w-[9rem]"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="in_progress">In progress</option>
            <option value="draft">Draft</option>
            <option value="failed">Failed</option>
          </select>
          <div className="flex gap-2">
            <Button
              type="button"
              className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white h-11 px-4"
              onClick={handleSearch}
            >
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-slate-200 h-11 px-3"
              onClick={handleReset}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="border border-slate-100 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
              Loading products…
            </div>
          ) : isError ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-red-600">Could not load products.</p>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-700">No products found</p>
              <p className="text-xs text-slate-500">
                {listingProducts.length === 0
                  ? "You have no Build Your Brand projects yet."
                  : "Try different search terms or reset filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[22rem] overflow-y-auto">
              {filteredProducts.map((product) => {
                const isSelected = selectedProductId === product.id;
                const imageUrl = resolveImageUrl(product.imageUrl);
                return (
                  <label
                    key={product.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                      isSelected ? "bg-orange-50" : "hover:bg-slate-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="build-brand-product"
                      checked={isSelected}
                      onChange={() => onSelectProduct(product.id)}
                      className="accent-orange-500"
                    />
                    <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{product.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {product.sku ? `SKU: ${product.sku}` : "No SKU"}
                        {product.category ? ` · ${product.category}` : ""}
                      </p>
                    </div>
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", statusBadgeClass(product.status))}>
                      {product.statusLabel}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <p className="text-xs text-slate-500">
          {selectedProductId
            ? "Selected product will load on the next step so you can continue where you left off."
            : "Optional — skip this step to create a brand-new product."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
          onClick={onSkipToUpload}
        >
          Create new product instead
        </Button>
      </div>
    </div>
  );
}
