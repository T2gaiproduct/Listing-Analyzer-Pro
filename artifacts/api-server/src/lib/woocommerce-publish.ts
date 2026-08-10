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
import { buildSignedPublishImageUrl } from "./marketplace-publish-image-token.js";
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

function isProtectedAppImageUrl(url: string): boolean {
  return /\/api\/images\/(?:\d+|graphics\/\d+)\//i.test(url);
}

function isPublicRemoteImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isProtectedAppImageUrl(url)) return false;
  return true;
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
  const resolved: WooCommerceProductImage[] = [];
  const seen = new Set<string>();

  for (const [index, asset] of imageAssets.entries()) {
    const candidates = [
      asset.sourceUrl?.trim(),
      asset.absoluteUrl?.trim(),
    ].filter((url): url is string => Boolean(url));

    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;

      if (isPublicRemoteImageUrl(candidate)) {
        resolved.push({
          src: candidate,
          alt: opts.altText,
          name: filenameForAsset(asset, index),
        });
        seen.add(candidate);
        break;
      }

      if (isProtectedAppImageUrl(candidate) && opts.publicBaseUrl?.trim()) {
        const signedUrl = buildSignedPublishImageUrl({
          publicBaseUrl: opts.publicBaseUrl,
          auditId: opts.audit.id,
          sourceUrl: asset.sourceUrl,
          graphicsProjectId: opts.graphicsProjectId,
        });
        if (signedUrl && !seen.has(signedUrl)) {
          resolved.push({
            src: signedUrl,
            alt: opts.altText,
            name: filenameForAsset(asset, index),
          });
          seen.add(signedUrl);
          break;
        }
      }
    }

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
    auditId: opts.audit.id,
    slug,
  });

  const images = await resolveWooCommerceProductImages({
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
          audit: opts.audit,
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

  const resolvedSku = product.sku?.trim() || sku || existing?.sku?.trim() || `SL-${opts.audit.id}`;

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
