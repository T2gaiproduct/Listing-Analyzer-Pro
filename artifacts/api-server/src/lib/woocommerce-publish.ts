import { and, eq } from "drizzle-orm";
import path from "node:path";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable, productProfilesTable } from "@workspace/db";
import {
  buildProductImageAssets,
  collectProductImages,
  loadImageBuffer,
  slugify,
  type ExportImageAsset,
} from "./listing-export-shared.js";
import type { WooCommerceStoreConnectionWithSecret } from "./marketplace-connections.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";
import {
  createWooCommerceProduct,
  findWooCommerceProductBySlug,
  updateWooCommerceProduct,
  uploadWooCommerceMedia,
  type WooCommerceProductImage,
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

function isProtectedAppImageUrl(url: string): boolean {
  return /\/api\/images\/(?:\d+|graphics\/\d+)\//i.test(url);
}

function isPublicRemoteImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isProtectedAppImageUrl(url)) return false;
  return true;
}

function contentTypeForFilename(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

function filenameForAsset(asset: ExportImageAsset, index: number): string {
  const fromZip = path.basename(asset.zipPath);
  if (fromZip && fromZip !== ".") return fromZip;
  const fromSource = path.basename((asset.sourceUrl.split("?")[0] ?? asset.sourceUrl));
  if (fromSource && fromSource !== ".") return fromSource;
  return `product-image-${String(index + 1).padStart(2, "0")}.jpg`;
}

async function resolveWooCommerceProductImages(opts: {
  connection: WooCommerceStoreConnectionWithSecret;
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  graphicsProjectId?: number | null;
  publicBaseUrl?: string;
  altText?: string;
  existingImages?: WooCommerceRestProduct["images"];
}): Promise<WooCommerceProductImage[]> {
  const productImages = collectProductImages(opts.audit, opts.graphicsImageRecords);
  const imageAssets = buildProductImageAssets(productImages, opts.publicBaseUrl);
  const resolved: WooCommerceProductImage[] = [];
  const seen = new Set<string>();

  for (const [index, asset] of imageAssets.entries()) {
    const candidates = [
      asset.sourceUrl?.trim(),
      asset.absoluteUrl?.trim(),
    ].filter((url): url is string => Boolean(url));

    let pushed = false;
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;

      if (isPublicRemoteImageUrl(candidate)) {
        resolved.push({
          src: candidate,
          alt: opts.altText,
          name: filenameForAsset(asset, index),
        });
        seen.add(candidate);
        pushed = true;
        break;
      }
    }
    if (pushed) continue;

    const buffer = await loadImageBuffer({
      auditId: opts.audit.id,
      sourceUrl: asset.sourceUrl,
      graphicsProjectId: opts.graphicsProjectId,
    });
    if (!buffer || buffer.length < 1024) continue;

    const filename = filenameForAsset(asset, index);
    const media = await uploadWooCommerceMedia({
      storeUrl: opts.connection.storeUrl,
      consumerKey: opts.connection.consumerKey,
      consumerSecret: opts.connection.consumerSecret,
      filename,
      contentType: contentTypeForFilename(filename),
      data: buffer,
    });
    resolved.push({
      id: media.id,
      src: media.source_url || undefined,
      alt: opts.altText,
      name: filename,
    });
    seen.add(`media:${media.id}`);
    if (resolved.length >= 9) break;
  }

  if (resolved.length > 0) return resolved.slice(0, 9);

  const fallback = (opts.existingImages ?? [])
    .filter((image) => image.id || image.src?.trim())
    .slice(0, 9)
    .map((image) => ({
      ...(image.id ? { id: image.id } : {}),
      ...(image.src?.trim() ? { src: image.src.trim() } : {}),
      alt: image.alt?.trim() || opts.altText,
      name: image.name?.trim() || undefined,
    }));

  return fallback;
}

function buildProductPayload(opts: {
  audit: Audit;
  slug: string;
  sku: string;
  price: string | null;
  publishMode: WooCommercePublishMode;
  images: WooCommerceProductImage[];
}): WooCommerceProductPayload {
  const content = resolveListingContentForExport(opts.audit);
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
    images: opts.images.length > 0 ? opts.images : undefined,
    categories: category ? [{ name: category }] : undefined,
    tags: tags.length > 0 ? tags : undefined,
  };
}

export async function publishListingToWooCommerce(opts: {
  connection: WooCommerceStoreConnectionWithSecret;
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  graphicsProjectId?: number | null;
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

  const existing = await findWooCommerceProductBySlug({
    storeUrl: opts.connection.storeUrl,
    consumerKey: opts.connection.consumerKey,
    consumerSecret: opts.connection.consumerSecret,
    slug,
  });

  const images = await resolveWooCommerceProductImages({
    connection: opts.connection,
    audit: opts.audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    graphicsProjectId: opts.graphicsProjectId,
    publicBaseUrl: opts.publicBaseUrl,
    altText: content.title,
    existingImages: existing?.images,
  });

  const payload = buildProductPayload({
    audit: opts.audit,
    slug,
    sku,
    price,
    publishMode,
    images,
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
