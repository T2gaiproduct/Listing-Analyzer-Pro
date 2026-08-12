import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable, productProfilesTable } from "@workspace/db";
import {
  stripHtml,
  truncate,
} from "./listing-export-shared.js";
import { resolveAmazonMarketplace } from "./amazon-marketplaces.js";
import { publishListingToAmazon } from "./amazon-sp-api.js";
import type { AmazonSpSettings } from "./amazon-sp-settings.js";
import {
  materializeAuditImagesForPublish,
  resolvePublishImageUrlsFromAudit,
} from "./materialize-audit-images-for-publish.js";
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
  return resolvePublishImageUrlsFromAudit(opts);
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
  const audit = await materializeAuditImagesForPublish(opts.audit);
  const marketplace = resolveAmazonMarketplace(opts.marketplaceCode);
  const content = resolveListingContentForExport(audit);
  if (!content.title.trim()) {
    throw new Error("Listing title is required before publishing to Amazon.");
  }

  const [profile] = await db
    .select({ sku: productProfilesTable.sku })
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, audit.id))
    .limit(1);

  const [amazonListing] = await db
    .select({
      priceCents: productMarketplaceListingsTable.priceCents,
      currency: productMarketplaceListingsTable.currency,
      sku: productMarketplaceListingsTable.sku,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, audit.id),
      eq(productMarketplaceListingsTable.marketplace, "Amazon"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .limit(1);

  const sku = resolvePublishSku({
    profileSku: profile?.sku,
    listingSku: amazonListing?.sku,
    auditId: audit.id,
  });

  const brand = audit.brandName?.trim() || audit.productName?.trim() || "Brand";
  const bullets = content.bulletPoints.map((bullet) => truncate(bullet, BULLET_MAX)).slice(0, 5);
  const keywords = truncate(content.keywords.join(" ").replace(/\s+/g, " "), KEYWORDS_MAX);
  const description = truncate(stripHtml(content.htmlDescription || ""), DESCRIPTION_MAX);
  const imageUrls = resolvePublishImageUrls({
    audit,
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

  const listingUrl = resolveAmazonListingUrl(marketplace.id, audit.asin);
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
      eq(productMarketplaceListingsTable.auditId, audit.id),
      eq(productMarketplaceListingsTable.marketplace, "Amazon"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .returning({ id: productMarketplaceListingsTable.id });

  if (listingUpdate.length === 0 && audit.workspaceId) {
    await db.insert(productMarketplaceListingsTable).values({
      auditId: audit.id,
      workspaceId: audit.workspaceId,
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
