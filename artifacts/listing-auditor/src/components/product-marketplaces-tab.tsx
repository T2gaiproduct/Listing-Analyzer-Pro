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
}

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

  const liveListings = useMemo(
    () => (data?.listings ?? []).filter((listing) => listing.status === "live"),
    [data?.listings],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (liveListings.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
        <p className="text-xs font-medium text-slate-800">No live marketplace listings</p>
        <p className="text-[11px] text-slate-500 mt-1">
          This product is not live on any marketplace yet. Publish from the workflow or import from a connected store.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {liveListings.map((listing) => (
        <MarketplaceCard key={listing.marketplace} listing={listing} />
      ))}
    </div>
  );
}
