import {
  listProductMarketplaces,
  type MarketplaceListingRow,
} from "./product-marketplaces.js";

const MARKETPLACE_ORDER = ["Amazon", "Flipkart", "Shopsy", "Shopify", "WooCommerce", "Meesho"] as const;

export interface WorkspaceProductMarketplaceRow {
  id: number;
  name: string;
  sku: string;
  imageUrl: string | null;
  detailUrl: string;
  listings: MarketplaceListingRow[];
  liveCount: number;
}

export interface WorkspaceMarketplaceSummary {
  marketplace: string;
  liveCount: number;
  pendingCount: number;
  notListedCount: number;
  productCount: number;
}

export interface WorkspaceMarketplacesOverview {
  summary: {
    totalProducts: number;
    liveListings: number;
    pendingListings: number;
    activeMarketplaces: number;
  };
  marketplaces: WorkspaceMarketplaceSummary[];
  products: WorkspaceProductMarketplaceRow[];
}

export async function getWorkspaceMarketplacesOverview(input: {
  workspaceId: number;
  products: Array<{
    id: number;
    name: string;
    sku: string;
    imageUrl: string | null;
  }>;
}): Promise<WorkspaceMarketplacesOverview> {
  const { products } = input;

  const productRows: WorkspaceProductMarketplaceRow[] = [];
  const marketplaceStats = new Map<string, { live: number; pending: number; notListed: number; products: number }>();

  for (const marketplace of MARKETPLACE_ORDER) {
    marketplaceStats.set(marketplace, { live: 0, pending: 0, notListed: 0, products: 0 });
  }

  for (const product of products) {
    const { listings } = await listProductMarketplaces(product.id);
    const liveCount = listings.filter((l) => l.status === "live").length;

    productRows.push({
      id: product.id,
      name: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl,
      detailUrl: `/products/${product.id}`,
      listings,
      liveCount,
    });

    for (const listing of listings) {
      const stats = marketplaceStats.get(listing.marketplace);
      if (!stats) continue;
      stats.products += 1;
      if (listing.status === "live") stats.live += 1;
      else if (listing.status === "pending") stats.pending += 1;
      else stats.notListed += 1;
    }
  }

  const marketplaces: WorkspaceMarketplaceSummary[] = MARKETPLACE_ORDER.map((marketplace) => {
    const stats = marketplaceStats.get(marketplace) ?? { live: 0, pending: 0, notListed: 0, products: 0 };
    return {
      marketplace,
      liveCount: stats.live,
      pendingCount: stats.pending,
      notListedCount: stats.notListed,
      productCount: stats.products,
    };
  });

  const liveListings = marketplaces.reduce((sum, m) => sum + m.liveCount, 0);
  const pendingListings = marketplaces.reduce((sum, m) => sum + m.pendingCount, 0);
  const activeMarketplaces = marketplaces.filter((m) => m.liveCount > 0).length;

  return {
    summary: {
      totalProducts: products.length,
      liveListings,
      pendingListings,
      activeMarketplaces,
    },
    marketplaces,
    products: productRows,
  };
}
