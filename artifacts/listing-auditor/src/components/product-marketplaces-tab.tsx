import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Clock, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api-fetch";
import { MarketplaceLogo } from "@/components/marketplace-logos";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ListingStatus = "live" | "pending" | "not_listed";

interface MarketplaceListing {
  id: number;
  marketplace: string;
  status: ListingStatus;
  statusLabel: string;
  sku: string | null;
  price: number | null;
  currency: string;
  inventory: number | null;
  publishedAt: string | null;
  listingUrl: string | null;
}

interface MarketplacesResponse {
  listings: MarketplaceListing[];
  activeCount: number;
  listedCount?: number;
  liveMarketplaces?: string[];
  listedMarketplaces?: string[];
}

const STATUS_SORT: Record<ListingStatus, number> = {
  live: 0,
  pending: 1,
  not_listed: 2,
};

function StatusBadge({ status, label }: { status: ListingStatus; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
        status === "live" && "bg-emerald-50 text-emerald-700 border-emerald-200",
        status === "pending" && "bg-amber-50 text-amber-700 border-amber-200",
        status === "not_listed" && "bg-slate-50 text-slate-500 border-slate-200",
      )}
    >
      {label}
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-800 text-right font-medium break-all">{children}</span>
    </div>
  );
}

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "—";
  if (currency === "INR") return `₹${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

function MarketplaceCard({ listing }: { listing: MarketplaceListing }) {
  const published = listing.publishedAt
    ? format(new Date(listing.publishedAt), "MMM d, yyyy")
    : "—";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-start justify-between gap-2 p-4 border-b border-slate-100">
        <MarketplaceLogo marketplace={listing.marketplace} className="h-6 w-28" />
        <StatusBadge status={listing.status} label={listing.statusLabel} />
      </div>

      <div className="p-4 space-y-2 flex-1">
        <DetailRow label="SKU">{listing.sku ?? "—"}</DetailRow>
        <DetailRow label="Price">{formatPrice(listing.price, listing.currency)}</DetailRow>
        <DetailRow label="Inventory">
          {listing.inventory != null ? `${listing.inventory} units` : "—"}
        </DetailRow>
        <DetailRow label="Published">{published}</DetailRow>
        <DetailRow label="URL">
          {listing.listingUrl ? (
            <a
              href={listing.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
            >
              View listing
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            </a>
          ) : (
            "—"
          )}
        </DetailRow>
      </div>

      {listing.status === "live" && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-center gap-1.5 h-8 rounded-lg border border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">
            <Check className="w-3.5 h-3.5" />
            Live
          </div>
        </div>
      )}

      {listing.status === "pending" && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-center gap-1.5 h-8 rounded-lg border border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </div>
        </div>
      )}
    </div>
  );
}

function ListedMarketplacesSummary({
  liveMarketplaces,
  listedListings,
}: {
  liveMarketplaces: string[];
  listedListings: MarketplaceListing[];
}) {
  const pendingCount = listedListings.filter((listing) => listing.status === "pending").length;
  const liveCount = liveMarketplaces.length;
  const totalListed = listedListings.length;

  let headline = "Not listed on any marketplace yet";
  if (liveCount > 0) {
    headline = liveCount === 1
      ? `Live on ${liveMarketplaces[0]}`
      : `Live on ${liveCount} marketplaces`;
  } else if (totalListed > 0) {
    headline = totalListed === 1
      ? `Listed on ${listedListings[0]?.marketplace}`
      : `Listed on ${totalListed} marketplaces`;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div>
        <p className="text-xs font-semibold text-slate-900">{headline}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {totalListed === 0
            ? "Connect a marketplace or import from a store to list this product."
            : liveCount > 0 && pendingCount > 0
              ? `${liveCount} live · ${pendingCount} pending`
              : liveCount > 0
                ? "This product is actively selling on the platforms below."
                : "Listings are queued and not live yet."}
        </p>
      </div>

      {listedListings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {listedListings.map((listing) => (
            <span
              key={listing.marketplace}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 bg-slate-50",
                listing.status === "live" && "border-emerald-200 bg-emerald-50/50",
                listing.status === "pending" && "border-amber-200 bg-amber-50/50",
              )}
            >
              <MarketplaceLogo marketplace={listing.marketplace} className="h-4 w-20" />
              <StatusBadge status={listing.status} label={listing.statusLabel} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductMarketplacesTab({
  productId,
  enabled,
  source,
}: {
  productId: number;
  enabled: boolean;
  source?: string;
}) {
  const sourceQuery = source ? `?source=${encodeURIComponent(source)}` : "";

  const { data, isLoading } = useQuery({
    queryKey: ["product-marketplaces", productId, source],
    queryFn: () => fetchJson<MarketplacesResponse>(`${basePath}/api/products/${productId}/marketplaces${sourceQuery}`),
    enabled: enabled && productId > 0,
    staleTime: 15_000,
  });

  const listedListings = useMemo(() => {
    const listings = data?.listings ?? [];
    return listings
      .filter((listing) => listing.status !== "not_listed" && listing.id > 0)
      .sort((a, b) => STATUS_SORT[a.status] - STATUS_SORT[b.status]);
  }, [data?.listings]);

  const liveMarketplaces = useMemo(
    () => data?.liveMarketplaces
      ?? listedListings.filter((listing) => listing.status === "live").map((listing) => listing.marketplace),
    [data?.liveMarketplaces, listedListings],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListedMarketplacesSummary
        liveMarketplaces={liveMarketplaces}
        listedListings={listedListings}
      />

      {listedListings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {listedListings.map((listing) => (
            <MarketplaceCard key={listing.marketplace} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
