import { useMemo } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Clock, ExternalLink, Loader2, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchJson, ApiFetchError } from "@/lib/api-fetch";
import { MarketplaceLogo } from "@/components/marketplace-logos";
import { fetchShopifyStatus, publishAuditToShopify } from "@/lib/shopify-publish";
import { fetchWooCommerceStatus, publishAuditToWooCommerce } from "@/lib/woocommerce-publish";
import { fetchAmazonStatus, publishAuditToAmazon } from "@/lib/amazon-publish";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const PUBLISH_PLATFORMS = ["Amazon", "Shopify", "WooCommerce"] as const;
type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

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

function buildPublishPlatformCards(listings: MarketplaceListing[]): MarketplaceListing[] {
  const byMarketplace = new Map(listings.map((listing) => [listing.marketplace, listing]));
  return PUBLISH_PLATFORMS.map((marketplace) => {
    const existing = byMarketplace.get(marketplace);
    if (existing && existing.id > 0) return existing;
    return {
      id: 0,
      marketplace,
      status: "not_listed" as const,
      statusLabel: "Not Listed",
      sku: null,
      price: null,
      currency: "USD",
      inventory: null,
      publishedAt: null,
      listingUrl: null,
    };
  });
}

function MarketplaceCard({
  listing,
  canPublish,
  isPublishing,
  publishReady,
  connected,
  connectHint,
  onPublishLive,
  onPublishDraft,
}: {
  listing: MarketplaceListing;
  canPublish: boolean;
  isPublishing: boolean;
  publishReady: boolean;
  connected: boolean;
  connectHint: string;
  onPublishLive?: () => void;
  onPublishDraft?: () => void;
}) {
  const published = listing.publishedAt
    ? format(new Date(listing.publishedAt), "MMM d, yyyy")
    : "—";
  const isAmazon = listing.marketplace === "Amazon";
  const showPublishActions = canPublish && listing.status !== "live";
  const publishDisabled = isPublishing || !publishReady || !connected;

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
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center justify-center gap-1.5 h-8 rounded-lg border border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">
            <Check className="w-3.5 h-3.5" />
            Live
          </div>
          {showPublishActions && onPublishLive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-[11px] rounded-lg border-orange-200 text-orange-600 hover:bg-orange-50"
              disabled={publishDisabled}
              onClick={onPublishLive}
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Update listing
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {listing.status === "pending" && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center justify-center gap-1.5 h-8 rounded-lg border border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </div>
          {showPublishActions && onPublishLive && (
            <Button
              type="button"
              size="sm"
              className="w-full h-8 text-[11px] rounded-lg bg-orange-500 hover:bg-orange-600"
              disabled={publishDisabled}
              onClick={onPublishLive}
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Publish live
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {listing.status === "not_listed" && showPublishActions && (
        <div className="px-4 pb-4 space-y-2">
          {!connected || !publishReady ? (
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {connectHint}{" "}
              <Link href="/marketplaces" className="text-orange-600 hover:underline font-medium">
                Open Marketplaces
              </Link>
            </p>
          ) : null}
          {onPublishLive && (
            <Button
              type="button"
              size="sm"
              className="w-full h-8 text-[11px] rounded-lg bg-orange-500 hover:bg-orange-600"
              disabled={publishDisabled}
              onClick={onPublishLive}
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  {isAmazon ? "Publish to Amazon" : "Publish live"}
                </>
              )}
            </Button>
          )}
          {!isAmazon && onPublishDraft && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-[11px] rounded-lg border-slate-200"
              disabled={publishDisabled}
              onClick={onPublishDraft}
            >
              Save as draft
            </Button>
          )}
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

  let headline = "Publish to Amazon, Shopify, or WooCommerce";
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
            ? "Connect your stores on the Marketplaces page, then publish this listing to each platform below."
            : liveCount > 0 && pendingCount > 0
              ? `${liveCount} live · ${pendingCount} pending · publish or update on any connected platform`
              : liveCount > 0
                ? "This product is actively selling on the platforms below. Republish to push latest listing changes."
                : "Listings are queued and not live yet. Use Publish live on each platform when ready."}
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
  auditId,
  enabled,
  source,
  canPublish = false,
}: {
  productId: number;
  auditId?: number;
  enabled: boolean;
  source?: string;
  canPublish?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sourceQuery = source ? `?source=${encodeURIComponent(source)}` : "";
  const publishAuditId = auditId ?? productId;

  const { data, isLoading } = useQuery({
    queryKey: ["product-marketplaces", productId, source],
    queryFn: () => fetchJson<MarketplacesResponse>(`${basePath}/api/products/${productId}/marketplaces${sourceQuery}`),
    enabled: enabled && productId > 0,
    staleTime: 15_000,
  });

  const { data: shopifyStatus } = useQuery({
    queryKey: ["shopify-status"],
    queryFn: fetchShopifyStatus,
    enabled: enabled,
    staleTime: 60_000,
  });

  const { data: woocommerceStatus } = useQuery({
    queryKey: ["woocommerce-status"],
    queryFn: fetchWooCommerceStatus,
    enabled: enabled,
    staleTime: 60_000,
  });

  const { data: amazonStatus } = useQuery({
    queryKey: ["amazon-status"],
    queryFn: fetchAmazonStatus,
    enabled: enabled,
    staleTime: 60_000,
  });

  const invalidateAfterPublish = () => {
    void queryClient.invalidateQueries({ queryKey: ["product-marketplaces", productId, source] });
    void queryClient.invalidateQueries({ queryKey: ["product", productId] });
  };

  const publishShopifyMutation = useMutation({
    mutationFn: (publishMode: "draft" | "live") =>
      publishAuditToShopify({ auditId: publishAuditId, publishMode }),
    onSuccess: (result, publishMode) => {
      invalidateAfterPublish();
      if (result.warning) {
        toast({ title: "Published with a warning", description: result.warning, variant: "destructive" });
        return;
      }
      toast({
        title: publishMode === "live" ? "Published to Shopify" : "Saved to Shopify draft",
        description: result.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Shopify publish failed",
        description: error instanceof Error ? error.message : "Could not publish to Shopify.",
        variant: "destructive",
      });
    },
  });

  const publishWooCommerceMutation = useMutation({
    mutationFn: (publishMode: "draft" | "live") =>
      publishAuditToWooCommerce({ auditId: publishAuditId, publishMode }),
    onSuccess: (result, publishMode) => {
      invalidateAfterPublish();
      if (result.warning) {
        toast({ title: "Published with a warning", description: result.warning, variant: "destructive" });
        return;
      }
      toast({
        title: publishMode === "live" ? "Published to WooCommerce" : "Saved to WooCommerce draft",
        description: result.message,
      });
    },
    onError: (error) => {
      toast({
        title: "WooCommerce publish failed",
        description: error instanceof Error ? error.message : "Could not publish to WooCommerce.",
        variant: "destructive",
      });
    },
  });

  const publishAmazonMutation = useMutation({
    mutationFn: () => publishAuditToAmazon({
      auditId: publishAuditId,
      marketplace: amazonStatus?.defaultMarketplace,
    }),
    onSuccess: (result) => {
      invalidateAfterPublish();
      if (result.warning) {
        toast({ title: "Published with a warning", description: result.warning, variant: "destructive" });
        return;
      }
      toast({
        title: result.sandbox ? "Published to Amazon sandbox" : "Published to Amazon",
        description: result.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Amazon publish failed",
        description: error instanceof ApiFetchError ? error.message : error instanceof Error ? error.message : "Could not publish to Amazon.",
        variant: "destructive",
      });
    },
  });

  const listedListings = useMemo(() => {
    const listings = data?.listings ?? [];
    return listings
      .filter((listing) => listing.status !== "not_listed" && listing.id > 0)
      .sort((a, b) => STATUS_SORT[a.status] - STATUS_SORT[b.status]);
  }, [data?.listings]);

  const publishPlatformCards = useMemo(
    () => buildPublishPlatformCards(data?.listings ?? []),
    [data?.listings],
  );

  const liveMarketplaces = useMemo(
    () => data?.liveMarketplaces
      ?? listedListings.filter((listing) => listing.status === "live").map((listing) => listing.marketplace),
    [data?.liveMarketplaces, listedListings],
  );

  const platformPublishState: Record<PublishPlatform, {
    connected: boolean;
    publishReady: boolean;
    connectHint: string;
    isPublishing: boolean;
    onPublishLive: () => void;
    onPublishDraft?: () => void;
  }> = {
    Amazon: {
      connected: Boolean(amazonStatus?.connected),
      publishReady: Boolean(amazonStatus?.publishReady && amazonStatus?.connected),
      connectHint: "Connect Amazon seller credentials to publish.",
      isPublishing: publishAmazonMutation.isPending,
      onPublishLive: () => publishAmazonMutation.mutate(),
    },
    Shopify: {
      connected: Boolean(shopifyStatus?.connected),
      publishReady: Boolean(shopifyStatus?.publishReady),
      connectHint: "Add Shopify Client ID and secret to publish.",
      isPublishing: publishShopifyMutation.isPending,
      onPublishLive: () => publishShopifyMutation.mutate("live"),
      onPublishDraft: () => publishShopifyMutation.mutate("draft"),
    },
    WooCommerce: {
      connected: Boolean(woocommerceStatus?.connected),
      publishReady: Boolean(woocommerceStatus?.publishReady),
      connectHint: "Add WooCommerce API keys to publish.",
      isPublishing: publishWooCommerceMutation.isPending,
      onPublishLive: () => publishWooCommerceMutation.mutate("live"),
      onPublishDraft: () => publishWooCommerceMutation.mutate("draft"),
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {publishPlatformCards.map((listing) => {
          const platform = listing.marketplace as PublishPlatform;
          const state = platformPublishState[platform];
          return (
            <MarketplaceCard
              key={listing.marketplace}
              listing={listing}
              canPublish={canPublish && publishAuditId > 0}
              isPublishing={state.isPublishing}
              publishReady={state.publishReady}
              connected={state.connected}
              connectHint={state.connectHint}
              onPublishLive={state.onPublishLive}
              onPublishDraft={state.onPublishDraft}
            />
          );
        })}
      </div>
    </div>
  );
}
