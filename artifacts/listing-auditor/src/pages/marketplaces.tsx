import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Package, Search, Store } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api-fetch";
import { useBranding } from "@/hooks/use-branding";
import { useWorkspace } from "@/hooks/use-workspace";
import { WORKSPACES_HUB_LABEL } from "@/lib/workspaces-hub";
import { MarketplaceLogo } from "@/components/marketplace-logos";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ListingStatus = "live" | "pending" | "not_listed";

interface MarketplaceSummary {
  marketplace: string;
  liveCount: number;
  pendingCount: number;
  notListedCount: number;
  productCount: number;
}

interface ProductListingRow {
  id: number;
  name: string;
  sku: string;
  imageUrl: string | null;
  detailUrl: string;
  liveCount: number;
  listings: Array<{
    marketplace: string;
    status: ListingStatus;
    statusLabel: string;
  }>;
}

interface MarketplacesOverview {
  summary: {
    totalProducts: number;
    liveListings: number;
    pendingListings: number;
    activeMarketplaces: number;
  };
  marketplaces: MarketplaceSummary[];
  products: ProductListingRow[];
}

function statusChipClass(status: ListingStatus): string {
  switch (status) {
    case "live":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-50 text-slate-500 border-slate-200";
  }
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function MarketplaceSummaryCard({ item }: { item: MarketplaceSummary }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
      <MarketplaceLogo marketplace={item.marketplace} className="h-6 w-28" />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-slate-400">Live</p>
          <p className="text-sm font-semibold text-emerald-700 tabular-nums">{item.liveCount}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Pending</p>
          <p className="text-sm font-semibold text-amber-700 tabular-nums">{item.pendingCount}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Not listed</p>
          <p className="text-sm font-semibold text-slate-600 tabular-nums">{item.notListedCount}</p>
        </div>
      </div>
    </div>
  );
}

export default function MarketplacesPage() {
  const { platformName } = useBranding();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { featureWorkspaceId, isLoading: wsLoading, needsWorkspaceSelection } = useWorkspace();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["marketplaces", featureWorkspaceId],
    queryFn: () => fetchJson<MarketplacesOverview>(`${basePath}/api/marketplaces`),
    enabled: clerkLoaded && !!user && !!featureWorkspaceId,
    staleTime: 10_000,
    refetchOnMount: "always",
    retry: 1,
  });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.products ?? []).filter((product) => {
      if (q) {
        const hay = `${product.name} ${product.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (marketplaceFilter !== "all") {
        const listing = product.listings.find((l) => l.marketplace === marketplaceFilter);
        if (!listing || listing.status === "not_listed") return false;
      }
      return true;
    });
  }, [data?.products, search, marketplaceFilter]);

  if (wsLoading || (isLoading && featureWorkspaceId)) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!featureWorkspaceId || needsWorkspaceSelection) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Store className="w-10 h-10 text-slate-300 mb-3" />
        <h2 className="text-base font-semibold text-slate-900">Select a workspace</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-md">
          Marketplace listings are scoped to a workspace. Choose one in the top bar, or create a workspace from {WORKSPACES_HUB_LABEL}.
        </p>
        <Button asChild size="sm" className="mt-5 bg-orange-500 hover:bg-orange-600 text-xs h-8">
          <Link href="/workspaces">{WORKSPACES_HUB_LABEL}</Link>
        </Button>
      </div>
    );
  }

  const summary = data?.summary;
  const marketplaces = data?.marketplaces ?? [];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        <span>{platformName}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600">Marketplaces</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Marketplaces</h1>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="h-8 pl-8 text-xs border-slate-200 bg-white rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Products" value={summary?.totalProducts ?? 0} />
        <SummaryCard label="Live listings" value={summary?.liveListings ?? 0} />
        <SummaryCard label="Pending" value={summary?.pendingListings ?? 0} />
        <SummaryCard label="Active channels" value={summary?.activeMarketplaces ?? 0} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {marketplaces.map((item) => (
          <MarketplaceSummaryCard key={item.marketplace} item={item} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMarketplaceFilter("all")}
          className={cn(
            "h-7 px-3 rounded-full text-[11px] font-medium border transition-colors",
            marketplaceFilter === "all"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          All
        </button>
        {marketplaces.map((item) => (
          <button
            key={item.marketplace}
            type="button"
            onClick={() => setMarketplaceFilter(item.marketplace)}
            className={cn(
              "h-7 px-3 rounded-full text-[11px] font-medium border transition-colors",
              marketplaceFilter === item.marketplace
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {item.marketplace}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Product</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">SKU</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Live channels</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Marketplace status</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-700">No marketplace listings yet</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      Add products and publish listings to see them across your marketplaces.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const activeListings = product.listings.filter((l) => l.status !== "not_listed");
                  return (
                    <tr
                      key={product.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors cursor-pointer"
                      onClick={() => navigate(product.detailUrl)}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <span className="text-xs font-medium text-slate-900">{product.name}</span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="text-[11px] font-mono text-slate-500">{product.sku}</span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="text-xs font-semibold text-slate-900 tabular-nums">{product.liveCount}</span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex flex-wrap gap-1">
                          {activeListings.length === 0 ? (
                            <span className="text-[11px] text-slate-400">—</span>
                          ) : (
                            activeListings.map((listing) => (
                              <span
                                key={listing.marketplace}
                                className={cn(
                                  "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium",
                                  statusChipClass(listing.status),
                                )}
                              >
                                {listing.marketplace}
                              </span>
                            ))
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
    </div>
  );
}
