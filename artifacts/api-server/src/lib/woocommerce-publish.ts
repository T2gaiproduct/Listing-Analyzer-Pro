import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable, productProfilesTable } from "@workspace/db";
import {
  buildProductImageAssets,
  collectProductImages,
  slugify,
} from "./listing-export-shared.js";
import type { WooCommerceStoreConnectionWithSecret } from "./marketplace-connections.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";
import {
  createWooCommerceProduct,
  findWooCommerceProductBySlug,
  updateWooCommerceProduct,
  type WooCommerceProductPayload,
  type WooCommerceRestProduct,
} from "./woocommerce-admin-client.js";
import { woocommerceSlugFromAsin } from "./woocommerce-import-utils.js";

export type WooCommercePublishMode = "draft" | "live";

export type WooCommercePublishResult = {
  productId: number;
  slug: string;
  listingUrl: string;
  status: "live" | "pending";
  created: boolean;
};

function wooCommerceProductUrl(storeUrl: string, slug: string): string {
  const base = storeUrl.trim().replace(/\/$/, "");
  const withProtocol = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  return `${withProtocol}/product/${slug}/`;
}

function parseProductPrice(product: WooCommerceRestProduct): number | null {
  const raw = product.price?.trim() || product.regular_price?.trim();
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function buildShortDescription(bulletPoints: string[]): string {
  return bulletPoints
    .map((bullet) => bullet.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join("\n");
}

function buildProductPayload(opts: {
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  publicBaseUrl?: string;
  slug: string;
  sku: string;
  price: string | null;
  publishMode: WooCommercePublishMode;
}): WooCommerceProductPayload {
  const content = resolveListingContentForExport(opts.audit);
  const productImages = collectProductImages(opts.audit, opts.graphicsImageRecords);
  const imageAssets = buildProductImageAssets(productImages, opts.publicBaseUrl);
  const images = imageAssets
    .map((asset) => asset.absoluteUrl?.trim() || asset.sourceUrl?.trim())
    .filter((src): src is string => Boolean(src))
    .slice(0, 9)
    .map((src) => ({ src }));

  const category = opts.audit.category?.trim();
  const tags = content.keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 15)
    .map((name) => ({ name }));

  return {
    name: content.title,
    slug: opts.slug,
    type: "simple",
    status: opts.publishMode === "live" ? "publish" : "draft",
    description: content.htmlDescription || undefined,
    short_description: buildShortDescription(content.bulletPoints) || undefined,
    sku: opts.sku,
    regular_price: opts.price ?? undefined,
    images: images.length > 0 ? images : undefined,
    categories: category ? [{ name: category }] : undefined,
    tags: tags.length > 0 ? tags : undefined,
  };
}

export async function publishListingToWooCommerce(opts: {
  connection: WooCommerceStoreConnectionWithSecret;
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  publicBaseUrl?: string;
  publishMode?: WooCommercePublishMode;
}): Promise<WooCommercePublishResult> {
  const publishMode = opts.publishMode ?? "draft";

  const [profile] = await db
    .select({ sku: productProfilesTable.sku })
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, opts.audit.id))
    .limit(1);

  const [wooListing] = await db
    .select({
      priceCents: productMarketplaceListingsTable.priceCents,
      currency: productMarketplaceListingsTable.currency,
      sku: productMarketplaceListingsTable.sku,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, opts.audit.id),
      eq(productMarketplaceListingsTable.marketplace, "WooCommerce"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .limit(1);

  const importedSlug = woocommerceSlugFromAsin(opts.audit.asin);
  const content = resolveListingContentForExport(opts.audit);
  const slug = importedSlug ?? slugify(content.title);
  if (!slug) throw new Error("Could not resolve WooCommerce product slug");

  const sku = profile?.sku?.trim()
    || wooListing?.sku?.trim()
    || `SL-${opts.audit.id}`;
  const priceCents = wooListing?.priceCents != null && wooListing.priceCents > 0
    ? wooListing.priceCents
    : null;
  const price = priceCents != null ? (priceCents / 100).toFixed(2) : null;
  const listingCurrency = wooListing?.currency?.trim() || "USD";

  const payload = buildProductPayload({
    audit: opts.audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    publicBaseUrl: opts.publicBaseUrl,
    slug,
    sku,
    price,
    publishMode,
  });

  const existing = await findWooCommerceProductBySlug({
    storeUrl: opts.connection.storeUrl,
    consumerKey: opts.connection.consumerKey,
    consumerSecret: opts.connection.consumerSecret,
    slug,
  });

  let product: WooCommerceRestProduct;
  let created = false;
  if (existing?.id) {
    product = await updateWooCommerceProduct({
      storeUrl: opts.connection.storeUrl,
      consumerKey: opts.connection.consumerKey,
      consumerSecret: opts.connection.consumerSecret,
      productId: existing.id,
      product: payload,
    });
  } else {
    product = await createWooCommerceProduct({
      storeUrl: opts.connection.storeUrl,
      consumerKey: opts.connection.consumerKey,
      consumerSecret: opts.connection.consumerSecret,
      product: payload,
    });
    created = true;
  }

  const listingUrl = product.permalink?.trim() || wooCommerceProductUrl(opts.connection.storeUrl, product.slug || slug);
  const listingStatus = publishMode === "live" ? "live" as const : "pending" as const;
  const responsePriceCents = parseProductPrice(product);
  const sentPriceCents = price != null ? Math.round(Number(price) * 100) : null;
  const resolvedPriceCents = responsePriceCents != null && responsePriceCents > 0
    ? responsePriceCents
    : sentPriceCents != null && sentPriceCents > 0
      ? sentPriceCents
      : priceCents;

  const listingUpdate = await db
    .update(productMarketplaceListingsTable)
    .set({
      status: listingStatus,
      sku,
      priceCents: resolvedPriceCents,
      currency: listingCurrency,
      listingUrl,
      publishedAt: publishMode === "live" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, opts.audit.id),
      eq(productMarketplaceListingsTable.marketplace, "WooCommerce"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .returning({ id: productMarketplaceListingsTable.id });

  if (listingUpdate.length === 0 && opts.audit.workspaceId) {
    await db.insert(productMarketplaceListingsTable).values({
      auditId: opts.audit.id,
      workspaceId: opts.audit.workspaceId,
      marketplace: "WooCommerce",
      status: listingStatus,
      sku,
      priceCents: resolvedPriceCents,
      currency: listingCurrency,
      listingUrl,
      publishedAt: publishMode === "live" ? new Date() : null,
    });
  }

  return {
    productId: product.id,
    slug: product.slug || slug,
    listingUrl,
    status: listingStatus,
    created,
  };
}
