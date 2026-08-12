import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable, productProfilesTable } from "@workspace/db";
import {
  buildProductImageAssets,
  collectProductImages,
  slugify,
  type ExportImageAsset,
} from "./listing-export-shared.js";
import type { WooCommerceStoreConnectionWithSecret } from "./marketplace-connections.js";
import {
  materializeAuditImagesForPublish,
  resolvePublishImageUrlsFromAudit,
  sanitizeMarketplacePublishImageUrl,
} from "./materialize-audit-images-for-publish.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";
import {
  createWooCommerceProduct,
  findWooCommerceProductBySku,
  findWooCommerceProductBySlug,
  updateWooCommerceProduct,
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
  warning?: string;
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

function filenameForAsset(asset: ExportImageAsset, index: number): string {
  const fromZip = asset.zipPath.split("/").pop();
  if (fromZip && fromZip !== ".") return fromZip;
  const fromSource = (asset.sourceUrl.split("?")[0] ?? asset.sourceUrl).split("/").pop();
  if (fromSource && fromSource !== ".") return fromSource;
  return `product-image-${String(index + 1).padStart(2, "0")}.jpg`;
}

async function resolveWooCommerceProductImages(opts: {
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  graphicsProjectId?: number | null;
  publicBaseUrl?: string;
  altText?: string;
  existingImages?: WooCommerceRestProduct["images"];
}): Promise<WooCommerceProductImage[]> {
  const productImages = collectProductImages(opts.audit, opts.graphicsImageRecords);
  const imageAssets = buildProductImageAssets(productImages, opts.publicBaseUrl);
  const publishUrls = resolvePublishImageUrlsFromAudit({
    audit: opts.audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    graphicsProjectId: opts.graphicsProjectId,
    publicBaseUrl: opts.publicBaseUrl,
  });

  const resolved: WooCommerceProductImage[] = publishUrls
    .map((src, index) => ({
      src: sanitizeMarketplacePublishImageUrl(src) ?? "",
      alt: opts.altText,
      name: filenameForAsset(imageAssets[index] ?? imageAssets[0]!, index),
    }))
    .filter((image) => Boolean(image.src));

  if (resolved.length > 0) return resolved.slice(0, 9);

  const fallback = (opts.existingImages ?? [])
    .filter((image) => image.id || image.src?.trim())
    .slice(0, 9)
    .map((image) => {
      const src = sanitizeMarketplacePublishImageUrl(image.src);
      return {
        ...(image.id ? { id: image.id } : {}),
        ...(src ? { src } : {}),
        alt: image.alt?.trim() || opts.altText,
        name: image.name?.trim() || undefined,
      };
    })
    .filter((image) => image.id || image.src);

  return fallback;
}

async function resolvePublishSku(opts: {
  connection: WooCommerceStoreConnectionWithSecret;
  existing: WooCommerceRestProduct | null;
  profileSku: string | null | undefined;
  listingSku: string | null | undefined;
  auditId: number;
  slug: string;
}): Promise<{ sku: string | undefined; warning?: string }> {
  const requested = opts.profileSku?.trim()
    || opts.listingSku?.trim()
    || opts.existing?.sku?.trim()
    || `SL-${opts.auditId}`;

  if (!opts.existing?.id) {
    const owner = await findWooCommerceProductBySku({
      ...opts.connection,
      sku: requested,
    });
    if (owner) {
      const uniqueSku = `${requested}-${opts.slug}`.slice(0, 96);
      return {
        sku: uniqueSku,
        warning: `SKU "${requested}" is already used on WooCommerce. Published with SKU "${uniqueSku}" instead.`,
      };
    }
    return { sku: requested };
  }

  const existingSku = opts.existing.sku?.trim();
  if (!existingSku || requested === existingSku) {
    return { sku: existingSku || requested };
  }

  const owner = await findWooCommerceProductBySku({
    ...opts.connection,
    sku: requested,
  });
  if (!owner || owner.id === opts.existing.id) {
    return { sku: requested };
  }

  return {
    sku: existingSku,
    warning: `SKU "${requested}" is already used by another WooCommerce product. Kept the store SKU "${existingSku}".`,
  };
}

function buildProductPayload(opts: {
  audit: Audit;
  slug: string;
  sku?: string;
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
    ...(opts.sku ? { sku: opts.sku } : {}),
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
  const audit = await materializeAuditImagesForPublish(opts.audit);

  const [profile] = await db
    .select({ sku: productProfilesTable.sku })
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, audit.id))
    .limit(1);

  const [wooListing] = await db
    .select({
      priceCents: productMarketplaceListingsTable.priceCents,
      currency: productMarketplaceListingsTable.currency,
      sku: productMarketplaceListingsTable.sku,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, audit.id),
      eq(productMarketplaceListingsTable.marketplace, "WooCommerce"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .limit(1);

  const importedSlug = woocommerceSlugFromAsin(audit.asin);
  const content = resolveListingContentForExport(audit);
  const slug = importedSlug ?? slugify(content.title);
  if (!slug) throw new Error("Could not resolve WooCommerce product slug");

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

  let { sku, warning: skuWarning } = await resolvePublishSku({
    connection: opts.connection,
    existing,
    profileSku: profile?.sku,
    listingSku: wooListing?.sku,
    auditId: audit.id,
    slug,
  });

  const images = await resolveWooCommerceProductImages({
    audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    graphicsProjectId: opts.graphicsProjectId,
    publicBaseUrl: opts.publicBaseUrl,
    altText: content.title,
    existingImages: existing?.images,
  });

  if (
    collectProductImages(audit, opts.graphicsImageRecords).length > 0
    && images.length === 0
  ) {
    throw new Error(
      "Could not prepare product images for WooCommerce. Redeploy or restart the API server, then publish again.",
    );
  }

  const payload = buildProductPayload({
    audit,
    slug,
    sku,
    price,
    publishMode,
    images,
  });

  let product: WooCommerceRestProduct;
  let created = false;
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (existing?.id && /product_invalid_sku|duplicated sku/i.test(message) && existing.sku?.trim()) {
      product = await updateWooCommerceProduct({
        storeUrl: opts.connection.storeUrl,
        consumerKey: opts.connection.consumerKey,
        consumerSecret: opts.connection.consumerSecret,
        productId: existing.id,
        product: buildProductPayload({
          audit,
          slug,
          sku: existing.sku.trim(),
          price,
          publishMode,
          images,
        }),
      });
      skuWarning = skuWarning ?? `SKU "${sku}" is already used on WooCommerce. Kept the store SKU "${existing.sku.trim()}".`;
    } else {
      throw err;
    }
  }

  const resolvedSku = product.sku?.trim() || sku || existing?.sku?.trim() || `SL-${audit.id}`;

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
      sku: resolvedSku,
      priceCents: resolvedPriceCents,
      currency: listingCurrency,
      listingUrl,
      publishedAt: publishMode === "live" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, audit.id),
      eq(productMarketplaceListingsTable.marketplace, "WooCommerce"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .returning({ id: productMarketplaceListingsTable.id });

  if (listingUpdate.length === 0 && audit.workspaceId) {
    await db.insert(productMarketplaceListingsTable).values({
      auditId: audit.id,
      workspaceId: audit.workspaceId,
      marketplace: "WooCommerce",
      status: listingStatus,
      sku: resolvedSku,
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
    warning: skuWarning,
  };
}
