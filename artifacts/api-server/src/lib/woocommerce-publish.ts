import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, auditsTable, productMarketplaceListingsTable, productProfilesTable } from "@workspace/db";
import {
  buildProductImageAssets,
  collectProductImages,
  loadImageBuffer,
  slugify,
  type ExportImageAsset,
} from "./listing-export-shared.js";
import type { WooCommerceStoreConnectionWithSecret } from "./marketplace-connections.js";
import { extractEmbeddedDataImageUrl, persistDataUrlAsAuditImage, repairCorruptedImageUrl } from "./image-storage.js";
import {
  materializeAuditImagesForPublish,
  resolvePublishImageCandidate,
  resolvePublishImageUrlsFromAudit,
  sanitizeMarketplacePublishImageUrl,
} from "./materialize-audit-images-for-publish.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";
import {
  createWooCommerceProduct,
  findWooCommerceProductBySku,
  findWooCommerceProductBySlug,
  updateWooCommerceProduct,
  uploadWooCommerceMedia,
  type WooCommerceProductImage,
  type WooCommerceProductPayload,
  type WooCommerceRestProduct,
} from "./woocommerce-admin-client.js";
import { woocommerceSlugFromAsin } from "./woocommerce-import-utils.js";
import { resolveAuditListingPriceCents } from "./product-marketplaces.js";

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

function contentTypeForImageSource(sourceUrl: string): { contentType: string; ext: string } {
  const lower = sourceUrl.toLowerCase();
  if (lower.includes(".png") || lower.startsWith("data:image/png")) {
    return { contentType: "image/png", ext: "png" };
  }
  if (lower.includes(".webp") || lower.startsWith("data:image/webp")) {
    return { contentType: "image/webp", ext: "webp" };
  }
  return { contentType: "image/jpeg", ext: "jpg" };
}

function finalizeWooCommerceImages(images: WooCommerceProductImage[]): WooCommerceProductImage[] {
  const result: WooCommerceProductImage[] = [];
  for (const image of images) {
    const safeSrc = sanitizeMarketplacePublishImageUrl(image.src);
    if (image.id) {
      const entry: WooCommerceProductImage = {
        id: image.id,
        alt: image.alt,
        name: image.name,
        ...(safeSrc ? { src: safeSrc } : {}),
      };
      result.push(entry);
      continue;
    }
    if (!safeSrc) continue;
    result.push({
      src: safeSrc,
      alt: image.alt,
      name: image.name,
    });
  }
  return result;
}

function isMediaUploadPermissionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /media upload failed \(401\)|media upload failed \(403\)|rest_cannot_create|not allowed to create posts/i.test(message);
}

async function resolveWooCommerceProductImages(opts: {
  audit: Audit;
  connection: WooCommerceStoreConnectionWithSecret;
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

  for (const [index, img] of productImages.entries()) {
    if (resolved.length >= 9) break;

    let sourceUrl = repairCorruptedImageUrl(img.url);
    const embedded = extractEmbeddedDataImageUrl(sourceUrl);
    if (embedded) {
      const persisted = persistDataUrlAsAuditImage(opts.audit.id, embedded, index);
      if (persisted) sourceUrl = persisted;
    }

    const buffer = await loadImageBuffer({
      auditId: opts.audit.id,
      sourceUrl,
      graphicsProjectId: opts.graphicsProjectId,
    });

    const asset = imageAssets[index] ?? imageAssets[0]!;
    const filename = filenameForAsset(asset, index);
    const { contentType } = contentTypeForImageSource(sourceUrl);

    const publicUrl = resolvePublishImageCandidate({
      auditId: opts.audit.id,
      sourceUrl,
      publicBaseUrl: opts.publicBaseUrl,
      graphicsProjectId: opts.graphicsProjectId,
      index,
    });
    const safe = sanitizeMarketplacePublishImageUrl(publicUrl);
    if (safe && !seen.has(safe)) {
      resolved.push({
        src: safe,
        alt: opts.altText,
        name: filename,
      });
      seen.add(safe);
      continue;
    }

    if (buffer) {
      try {
        const media = await uploadWooCommerceMedia({
          storeUrl: opts.connection.storeUrl,
          consumerKey: opts.connection.consumerKey,
          consumerSecret: opts.connection.consumerSecret,
          filename,
          contentType,
          data: buffer,
        });
        const key = `media:${media.id}`;
        if (!seen.has(key)) {
          resolved.push({
            id: media.id,
            alt: opts.altText,
            name: filename,
          });
          seen.add(key);
        }
      } catch (err) {
        if (!isMediaUploadPermissionError(err)) {
          throw err;
        }
        // Standard WooCommerce API keys cannot create wp/v2/media — signed URL is preferred.
      }
    }
  }

  if (resolved.length > 0) return finalizeWooCommerceImages(resolved);

  const publishUrls = resolvePublishImageUrlsFromAudit({
    audit: opts.audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    graphicsProjectId: opts.graphicsProjectId,
    publicBaseUrl: opts.publicBaseUrl,
  });

  for (const [index, src] of publishUrls.entries()) {
    const safe = sanitizeMarketplacePublishImageUrl(src);
    if (!safe || seen.has(safe)) continue;
    resolved.push({
      src: safe,
      alt: opts.altText,
      name: filenameForAsset(imageAssets[index] ?? imageAssets[0]!, index),
    });
    seen.add(safe);
    if (resolved.length >= 9) break;
  }

  if (resolved.length > 0) return finalizeWooCommerceImages(resolved);

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

  return finalizeWooCommerceImages(fallback);
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
  const safeImages = finalizeWooCommerceImages(opts.images);

  return {
    name: content.title,
    slug: opts.slug,
    type: "simple",
    status: opts.publishMode === "live" ? "publish" : "draft",
    description: content.htmlDescription || undefined,
    short_description: buildShortDescription(content.bulletPoints) || undefined,
    ...(opts.sku ? { sku: opts.sku } : {}),
    ...(opts.price ? { regular_price: opts.price } : {}),
    images: safeImages.length > 0 ? safeImages : undefined,
    categories: category ? [{ name: category }] : undefined,
    tags: tags.length > 0 ? tags : undefined,
  };
}

function buildWooCommercePricePatch(opts: {
  product: WooCommerceRestProduct;
  slug: string;
  price: string;
  publishMode: WooCommercePublishMode;
}): WooCommerceProductPayload {
  return {
    name: opts.product.name,
    slug: opts.product.slug || opts.slug,
    type: "simple",
    status: opts.publishMode === "live"
      ? "publish"
      : (opts.product.status as WooCommerceProductPayload["status"]) ?? "draft",
    regular_price: opts.price,
  };
}

export async function syncWooCommerceStorePrice(opts: {
  connection: WooCommerceStoreConnectionWithSecret;
  audit: Audit;
  priceCents: number;
  sku?: string | null;
  slug?: string | null;
  publishMode?: WooCommercePublishMode;
}): Promise<WooCommerceRestProduct | null> {
  if (opts.priceCents <= 0) return null;

  const price = (opts.priceCents / 100).toFixed(2);
  const publishMode = opts.publishMode ?? "live";
  const content = resolveListingContentForExport(opts.audit);
  const slug = opts.slug?.trim()
    || woocommerceSlugFromAsin(opts.audit.asin)
    || slugify(content.title);

  const existing = await findWooCommerceProductBySlug({
    storeUrl: opts.connection.storeUrl,
    consumerKey: opts.connection.consumerKey,
    consumerSecret: opts.connection.consumerSecret,
    slug,
  }) ?? (opts.sku?.trim()
    ? await findWooCommerceProductBySku({
      storeUrl: opts.connection.storeUrl,
      consumerKey: opts.connection.consumerKey,
      consumerSecret: opts.connection.consumerSecret,
      sku: opts.sku.trim(),
    })
    : null);

  if (!existing?.id) return null;
  if (parseProductPrice(existing) === opts.priceCents) return existing;

  return updateWooCommerceProduct({
    storeUrl: opts.connection.storeUrl,
    consumerKey: opts.connection.consumerKey,
    consumerSecret: opts.connection.consumerSecret,
    productId: existing.id,
    product: buildWooCommercePricePatch({
      product: existing,
      slug,
      price,
      publishMode,
    }),
  });
}

export async function ensureLiveWooCommerceListingPriceOnStore(opts: {
  connection: WooCommerceStoreConnectionWithSecret;
  auditId: number;
  listing: { price: number | null; sku: string | null; status: string };
}): Promise<void> {
  if (opts.listing.status !== "live") return;
  if (opts.listing.price == null || opts.listing.price <= 0) return;

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(eq(auditsTable.id, opts.auditId))
    .limit(1);
  if (!audit) return;

  await syncWooCommerceStorePrice({
    connection: opts.connection,
    audit,
    priceCents: Math.round(opts.listing.price * 100),
    sku: opts.listing.sku,
    publishMode: "live",
  });
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

  const resolvedListingPrice = await resolveAuditListingPriceCents(audit.id);
  const priceCents = wooListing?.priceCents != null && wooListing.priceCents > 0
    ? wooListing.priceCents
    : resolvedListingPrice.priceCents;
  const price = priceCents != null && priceCents > 0 ? (priceCents / 100).toFixed(2) : null;
  const listingCurrency = wooListing?.currency?.trim()
    || resolvedListingPrice.currency
    || "USD";

  if (publishMode === "live" && !price) {
    throw new Error("Set a product price in Edit listing before publishing live to WooCommerce.");
  }

  const importedSlug = woocommerceSlugFromAsin(audit.asin);
  const content = resolveListingContentForExport(audit);
  const slug = importedSlug ?? slugify(content.title);
  if (!slug) throw new Error("Could not resolve WooCommerce product slug");

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
    connection: opts.connection,
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

  if (price && parseProductPrice(product) == null) {
    const resolvedSkuForSync = product.sku?.trim() || sku || existing?.sku?.trim() || profile?.sku?.trim() || null;
    const repriced = await syncWooCommerceStorePrice({
      connection: opts.connection,
      audit,
      priceCents: Math.round(Number(price) * 100),
      sku: resolvedSkuForSync,
      slug: product.slug || slug,
      publishMode,
    });
    if (repriced) product = repriced;
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
