import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable, productProfilesTable } from "@workspace/db";
import {
  buildProductImageAssets,
  collectProductImages,
  stripHtml,
  truncate,
} from "./listing-export-shared.js";
import { resolveAmazonMarketplace } from "./amazon-marketplaces.js";
import { publishListingToAmazon, type AmazonSpSettings } from "./amazon-sp-api.js";
import { buildSignedPublishImageUrl } from "./marketplace-publish-image-token.js";
import { resolveListingContentForExport } from "./resolve-listing-content.js";

const BULLET_MAX = 500;
const KEYWORDS_MAX = 250;
const DESCRIPTION_MAX = 2000;

export type AmazonPublishResult = {
  sku: string;
  marketplace: string;
  listingUrl: string | null;
  status: "live" | "pending";
  sandbox: boolean;
  warning?: string;
};

function isProtectedAppImageUrl(url: string): boolean {
  return /\/api\/images\/(?:\d+|graphics\/\d+)\//i.test(url);
}

function isPublicRemoteImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isProtectedAppImageUrl(url)) return false;
  return true;
}

function resolveAmazonListingUrl(marketplaceCode: string, asin: string | null | undefined): string | null {
  const trimmed = asin?.trim();
  if (!trimmed) return null;
  const marketplace = resolveAmazonMarketplace(marketplaceCode);
  return `https://www.${marketplace.domain}/dp/${trimmed}`;
}

function resolvePublishImageUrls(opts: {
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  graphicsProjectId?: number | null;
  publicBaseUrl?: string;
}): string[] {
  const productImages = collectProductImages(opts.audit, opts.graphicsImageRecords);
  const imageAssets = buildProductImageAssets(productImages, opts.publicBaseUrl);
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const asset of imageAssets) {
    const candidates = [
      asset.sourceUrl?.trim(),
      asset.absoluteUrl?.trim(),
    ].filter((url): url is string => Boolean(url));

    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;

      if (isPublicRemoteImageUrl(candidate)) {
        resolved.push(candidate);
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
          resolved.push(signedUrl);
          seen.add(signedUrl);
          break;
        }
      }
    }

    if (resolved.length >= 9) break;
  }

  return resolved;
}

function resolvePublishSku(opts: {
  profileSku: string | null | undefined;
  listingSku: string | null | undefined;
  auditId: number;
}): string {
  return opts.profileSku?.trim()
    || opts.listingSku?.trim()
    || `SL-${opts.auditId}`;
}

export async function publishListingToAmazonMarketplace(opts: {
  settings: AmazonSpSettings;
  refreshToken: string;
  sellerId: string;
  audit: Audit;
  marketplaceCode: string;
  graphicsImageRecords?: ImageRecord[];
  graphicsProjectId?: number | null;
  publicBaseUrl?: string;
}): Promise<AmazonPublishResult> {
  const marketplace = resolveAmazonMarketplace(opts.marketplaceCode);
  const content = resolveListingContentForExport(opts.audit);
  if (!content.title.trim()) {
    throw new Error("Listing title is required before publishing to Amazon.");
  }

  const [profile] = await db
    .select({ sku: productProfilesTable.sku })
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, opts.audit.id))
    .limit(1);

  const [amazonListing] = await db
    .select({
      priceCents: productMarketplaceListingsTable.priceCents,
      currency: productMarketplaceListingsTable.currency,
      sku: productMarketplaceListingsTable.sku,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, opts.audit.id),
      eq(productMarketplaceListingsTable.marketplace, "Amazon"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .limit(1);

  const sku = resolvePublishSku({
    profileSku: profile?.sku,
    listingSku: amazonListing?.sku,
    auditId: opts.audit.id,
  });

  const brand = opts.audit.brandName?.trim() || opts.audit.productName?.trim() || "Brand";
  const bullets = content.bulletPoints.map((bullet) => truncate(bullet, BULLET_MAX)).slice(0, 5);
  const keywords = truncate(content.keywords.join(" ").replace(/\s+/g, " "), KEYWORDS_MAX);
  const description = truncate(stripHtml(content.htmlDescription || ""), DESCRIPTION_MAX);
  const imageUrls = resolvePublishImageUrls({
    audit: opts.audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    graphicsProjectId: opts.graphicsProjectId,
    publicBaseUrl: opts.publicBaseUrl,
  });

  await publishListingToAmazon({
    settings: opts.settings,
    refreshToken: opts.refreshToken,
    input: {
      sellerId: opts.sellerId,
      sku,
      marketplaceCode: marketplace.id,
      title: truncate(content.title, 200),
      brand: truncate(brand, 100),
      bullets,
      description,
      keywords,
      imageUrls,
    },
  });

  const listingUrl = resolveAmazonListingUrl(marketplace.id, opts.audit.asin);
  const listingStatus = opts.settings.sandbox ? "pending" as const : "live" as const;
  const listingCurrency = amazonListing?.currency?.trim() || "USD";

  const listingUpdate = await db
    .update(productMarketplaceListingsTable)
    .set({
      status: listingStatus,
      sku,
      priceCents: amazonListing?.priceCents ?? null,
      currency: listingCurrency,
      listingUrl,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, opts.audit.id),
      eq(productMarketplaceListingsTable.marketplace, "Amazon"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .returning({ id: productMarketplaceListingsTable.id });

  if (listingUpdate.length === 0 && opts.audit.workspaceId) {
    await db.insert(productMarketplaceListingsTable).values({
      auditId: opts.audit.id,
      workspaceId: opts.audit.workspaceId,
      marketplace: "Amazon",
      status: listingStatus,
      sku,
      priceCents: amazonListing?.priceCents ?? null,
      currency: listingCurrency,
      listingUrl,
      publishedAt: new Date(),
    });
  }

  return {
    sku,
    marketplace: marketplace.id,
    listingUrl,
    status: listingStatus,
    sandbox: opts.settings.sandbox,
  };
}
