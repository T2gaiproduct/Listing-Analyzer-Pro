import * as cheerio from "cheerio";
import { and, eq, inArray } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
  type GeneratedContent,
} from "@workspace/db";
import { TARGET_MARKETPLACES } from "./create-product.js";
import { fetchWooCommerceCatalog, type WooCommerceRestProduct } from "./woocommerce-admin-client.js";
import { woocommerceAsin } from "./woocommerce-import-utils.js";
import type { ShopifySyncResult } from "./shopify-product-sync.js";

const DEFAULT_WORKFLOW_TEMPLATE = "build-brand-standard";
const MAX_IMPORT = 500;

function stripHtml(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, " ").trim();
}

export function parseWooCommerceTags(product: WooCommerceRestProduct): string[] {
  return (product.tags ?? [])
    .map((entry) => entry.name?.trim())
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 30);
}

export function resolveWooCommerceDescriptionHtml(product: WooCommerceRestProduct): string {
  const full = product.description?.trim();
  if (full) return full;
  const short = product.short_description?.trim();
  if (short) return short;
  return "";
}

export function parseWooCommerceBulletPoints(product: WooCommerceRestProduct): string[] {
  const bullets: string[] = [];
  const short = product.short_description ? stripHtml(product.short_description) : "";
  if (short) {
    bullets.push(...short.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 3).slice(0, 5));
  }
  if (bullets.length === 0 && product.description) {
    const description = stripHtml(product.description);
    bullets.push(
      ...description
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 20 && sentence.length < 300)
        .slice(0, 5),
    );
  }
  return bullets.slice(0, 7);
}

function buildStoreDescriptionContent(htmlDescription: string): GeneratedContent | null {
  const trimmed = htmlDescription.trim();
  if (!trimmed) return null;
  return { title: "", bulletPoints: [], keywords: [], htmlDescription: trimmed };
}

function mergeStoreDescriptionContent(
  existing: GeneratedContent | null | undefined,
  htmlDescription: string,
): GeneratedContent | null {
  const storeDescription = buildStoreDescriptionContent(htmlDescription);
  if (!storeDescription) return existing ?? null;
  if (existing?.title?.trim()) return existing;
  return storeDescription;
}

function resolveListingFields(product: WooCommerceRestProduct) {
  const priceRaw = product.price?.trim() || product.regular_price?.trim();
  const priceCents = priceRaw && Number.isFinite(Number.parseFloat(priceRaw))
    ? Math.round(Number.parseFloat(priceRaw) * 100)
    : null;
  const published = product.status === "publish";
  return {
    priceCents,
    currency: "USD",
    listingStatus: published ? "live" as const : "pending" as const,
    auditStatus: published ? "complete" as const : "draft" as const,
    productUrl: product.permalink?.trim() || null,
    publishedAt: published ? new Date() : null,
    inventory: null as number | null,
  };
}

async function loadExistingWooCommerceAudits(
  workspaceId: number,
  slugs: string[],
): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map();

  const asins = slugs.map(woocommerceAsin);
  const rows = await db
    .select({ id: auditsTable.id, asin: auditsTable.asin })
    .from(auditsTable)
    .where(and(
      eq(auditsTable.workspaceId, workspaceId),
      eq(auditsTable.isDeleted, 0),
      inArray(auditsTable.asin, asins),
    ));

  const map = new Map<string, number>();
  for (const row of rows) {
    const slug = row.asin?.replace(/^woocommerce:/, "");
    if (slug) map.set(slug, row.id);
  }
  return map;
}

export async function refreshWooCommerceProduct(input: {
  auditId: number;
  workspaceId: number;
  product: WooCommerceRestProduct;
}): Promise<void> {
  const title = input.product.name?.trim();
  if (!title) return;

  const listing = resolveListingFields(input.product);
  const bulletPoints = parseWooCommerceBulletPoints(input.product);
  const imageUrls = (input.product.images ?? [])
    .map((image) => image.src?.trim())
    .filter((src): src is string => Boolean(src))
    .slice(0, 9);
  const sku = input.product.sku?.trim() || input.product.slug.toUpperCase();
  const category = input.product.categories?.[0]?.name?.trim() || null;
  const [existing] = await db
    .select({ generatedContent: auditsTable.generatedContent })
    .from(auditsTable)
    .where(eq(auditsTable.id, input.auditId))
    .limit(1);
  const generatedContent = mergeStoreDescriptionContent(
    existing?.generatedContent as GeneratedContent | null | undefined,
    resolveWooCommerceDescriptionHtml(input.product),
  );

  await db
    .update(auditsTable)
    .set({
      projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
      productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
      title,
      bulletPoints,
      imageUrls,
      targetKeywords: parseWooCommerceTags(input.product),
      category,
      ...(generatedContent ? { generatedContent } : {}),
      updatedAt: new Date(),
    })
    .where(eq(auditsTable.id, input.auditId));

  await db
    .update(productProfilesTable)
    .set({
      sku,
      referenceLinks: listing.productUrl,
    })
    .where(eq(productProfilesTable.auditId, input.auditId));

  await db
    .update(productMarketplaceListingsTable)
    .set({
      status: listing.listingStatus,
      sku,
      priceCents: listing.priceCents,
      currency: listing.currency,
      listingUrl: listing.productUrl,
      publishedAt: listing.publishedAt,
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, input.auditId),
      eq(productMarketplaceListingsTable.marketplace, "WooCommerce"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));
}

export async function syncWooCommerceProducts(input: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  ownerId: string;
  createdByUserId: string | null;
  workspaceId: number;
}): Promise<ShopifySyncResult> {
  const catalog = await fetchWooCommerceCatalog({
    storeUrl: input.storeUrl,
    consumerKey: input.consumerKey,
    consumerSecret: input.consumerSecret,
    maxProducts: MAX_IMPORT,
  });

  if (catalog.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      updated: 0,
      total: 0,
      auditsQueued: 0,
      pendingAuditIds: [],
      products: [],
      errors: [],
    };
  }

  const existingAudits = await loadExistingWooCommerceAudits(
    input.workspaceId,
    catalog.map((product) => product.slug),
  );

  const result: ShopifySyncResult = {
    imported: 0,
    skipped: 0,
    updated: 0,
    total: catalog.length,
    auditsQueued: 0,
    pendingAuditIds: [],
    products: [],
    errors: [],
  };

  for (const product of catalog) {
    const slug = product.slug?.trim();
    const title = product.name?.trim();
    if (!slug || !title) {
      result.errors.push({ handle: slug || "unknown", error: "Missing product title or slug" });
      continue;
    }

    if (existingAudits.has(slug)) {
      const auditId = existingAudits.get(slug)!;
      try {
        await refreshWooCommerceProduct({ auditId, workspaceId: input.workspaceId, product });
        result.updated += 1;
      } catch (err) {
        result.errors.push({
          handle: slug,
          error: err instanceof Error ? err.message : "Refresh failed",
        });
      }
      result.skipped += 1;
      continue;
    }

    try {
      const bulletPoints = parseWooCommerceBulletPoints(product);
      const imageUrls = (product.images ?? [])
        .map((image) => image.src?.trim())
        .filter((src): src is string => Boolean(src))
        .slice(0, 9);
      const sku = product.sku?.trim() || slug.toUpperCase();
      const listing = resolveListingFields(product);
      const category = product.categories?.[0]?.name?.trim() || null;
      const generatedContent = buildStoreDescriptionContent(resolveWooCommerceDescriptionHtml(product));

      const [audit] = await db
        .insert(auditsTable)
        .values({
          userId: input.ownerId,
          createdByUserId: input.createdByUserId,
          workspaceId: input.workspaceId,
          projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          asin: woocommerceAsin(slug),
          brandName: null,
          category,
          title,
          bulletPoints,
          imageUrls,
          targetKeywords: parseWooCommerceTags(product),
          generatedContent,
          overallScore: 0,
          status: "pending",
          currentStep: 1,
        })
        .returning();

      await db.insert(productProfilesTable).values({
        auditId: audit.id,
        sku,
        priority: "medium",
        referenceLinks: listing.productUrl,
        workflowTemplate: DEFAULT_WORKFLOW_TEMPLATE,
        targetMarketplaces: ["WooCommerce"],
      });

      await db.insert(productMarketplaceListingsTable).values(
        TARGET_MARKETPLACES.map((marketplace) => ({
          auditId: audit.id,
          workspaceId: input.workspaceId,
          marketplace,
          status: marketplace === "WooCommerce" ? listing.listingStatus : "not_listed",
          sku: marketplace === "WooCommerce" ? sku : null,
          priceCents: marketplace === "WooCommerce" ? listing.priceCents : null,
          currency: listing.currency,
          listingUrl: marketplace === "WooCommerce" ? listing.productUrl : null,
          publishedAt: marketplace === "WooCommerce" ? listing.publishedAt : null,
          inventory: marketplace === "WooCommerce" ? listing.inventory : null,
        })),
      );

      existingAudits.set(slug, audit.id);
      result.imported += 1;
      result.pendingAuditIds.push(audit.id);
      result.products.push({
        id: audit.id,
        name: audit.projectName ?? audit.productName,
        sku,
        handle: slug,
        detailUrl: `/products/${audit.id}`,
        workflowUrl: `/audits/workflow?resume=${audit.id}`,
      });
    } catch (err) {
      result.errors.push({
        handle: slug,
        error: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  result.auditsQueued = result.pendingAuditIds.length;
  return result;
}
