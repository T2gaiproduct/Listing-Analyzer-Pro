import * as cheerio from "cheerio";
import { and, eq, inArray } from "drizzle-orm";
import {
  auditsTable,
  db,
  productMarketplaceListingsTable,
  productProfilesTable,
} from "@workspace/db";
import { TARGET_MARKETPLACES } from "./create-product.js";
import { assertAllowedOutboundUrl } from "./ssrf-guard.js";
import {
  isShopifyProductPublished,
  parseShopifyPublishedAt,
  summarizeShopifyVariants,
} from "./shopify-import-utils.js";
import { auditNeedsAnalysis } from "./listing-audit-runner.js";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

const DEFAULT_WORKFLOW_TEMPLATE = "build-brand-standard";
const MAX_PAGES = 40;
const PAGE_SIZE = 250;
const MAX_IMPORT = 500;

export type ShopifyCatalogProduct = {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string | string[];
  published_at?: string | null;
  images?: Array<{ src?: string }>;
  variants?: Array<{
    sku?: string;
    price?: string;
    inventory_quantity?: number | null;
    available?: boolean | null;
  }>;
};

export type ShopifySyncResult = {
  imported: number;
  skipped: number;
  updated: number;
  total: number;
  auditsQueued: number;
  pendingAuditIds: number[];
  products: Array<{
    id: number;
    name: string;
    sku: string;
    handle: string;
    detailUrl: string;
    workflowUrl: string;
  }>;
  errors: Array<{ handle: string; error: string }>;
};

function stripHtml(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, " ").trim();
}

function shopifyAsin(handle: string): string {
  return `shopify:${handle}`;
}

function normalizeStoreOrigin(storeUrl: string): string {
  const trimmed = storeUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  return url.origin;
}

export function normalizeShopifyTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  if (typeof tags === "string" && tags.trim()) {
    return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function parseBulletPoints(bodyHtml: string | undefined, tags: unknown): string[] {
  const bulletPoints: string[] = [];

  if (bodyHtml) {
    const description = stripHtml(bodyHtml);
    const sentences = description
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 300);
    bulletPoints.push(...sentences.slice(0, 5));
  }

  for (const tag of normalizeShopifyTags(tags).slice(0, 3)) {
    if (tag.length > 3) bulletPoints.push(tag);
  }

  return bulletPoints.slice(0, 7);
}

function parseKeywords(title: string, bulletPoints: string[]): string[] {
  const words = `${title} ${bulletPoints.join(" ")}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  return [...new Set(words)].slice(0, 12);
}

export async function fetchShopifyCatalogProducts(storeUrl: string): Promise<ShopifyCatalogProduct[]> {
  const origin = normalizeStoreOrigin(storeUrl);
  const products: ShopifyCatalogProduct[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${origin}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    await assertAllowedOutboundUrl(url);

    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      throw new Error(
        `Shopify returned HTTP ${res.status}. Make sure the store URL is correct and products are published.`,
      );
    }

    const data = await res.json() as { products?: ShopifyCatalogProduct[] };
    const batch = data.products ?? [];
    if (batch.length === 0) break;

    products.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return products;
}

function storeCurrencyForOrigin(origin: string): string {
  return /\.co\.in\b/i.test(origin) || /\.in$/i.test(new URL(origin).hostname) ? "INR" : "USD";
}

function resolveShopifyListingFields(product: ShopifyCatalogProduct, origin: string) {
  const { inventory, inStock } = summarizeShopifyVariants(product.variants);
  const priceRaw = product.variants?.[0]?.price;
  const priceCents = priceRaw ? Math.round(parseFloat(priceRaw) * 100) : null;
  const published = isShopifyProductPublished(product);
  const publishedAt = parseShopifyPublishedAt(product.published_at);
  const productUrl = `${origin}/products/${product.handle}`;

  return {
    inventory,
    inStock,
    priceCents,
    currency: storeCurrencyForOrigin(origin),
    published,
    publishedAt,
    productUrl,
    listingStatus: published ? "live" as const : "pending" as const,
    auditStatus: published ? "complete" as const : "draft" as const,
  };
}

async function loadExistingShopifyAudits(
  workspaceId: number,
  handles: string[],
): Promise<Map<string, number>> {
  if (handles.length === 0) return new Map();

  const asins = handles.map(shopifyAsin);
  const rows = await db
    .select({ id: auditsTable.id, asin: auditsTable.asin })
    .from(auditsTable)
    .where(
      and(
        eq(auditsTable.workspaceId, workspaceId),
        eq(auditsTable.isDeleted, 0),
        inArray(auditsTable.asin, asins),
      ),
    );

  const map = new Map<string, number>();
  for (const row of rows) {
    const handle = row.asin?.replace(/^shopify:/, "");
    if (handle) map.set(handle, row.id);
  }
  return map;
}

async function refreshShopifyProductFromCatalog(input: {
  auditId: number;
  workspaceId: number;
  product: ShopifyCatalogProduct;
  origin: string;
}): Promise<{ needsAudit: boolean }> {
  const listing = resolveShopifyListingFields(input.product, input.origin);
  const title = input.product.title?.trim();
  if (!title) return { needsAudit: false };

  const [existingAudit] = await db
    .select({
      result: auditsTable.result,
      overallScore: auditsTable.overallScore,
    })
    .from(auditsTable)
    .where(eq(auditsTable.id, input.auditId))
    .limit(1);

  const needsAudit = existingAudit ? auditNeedsAnalysis(existingAudit) : false;
  const bulletPoints = parseBulletPoints(input.product.body_html, input.product.tags);
  const imageUrls = (input.product.images ?? [])
    .map((img) => img.src?.trim())
    .filter((src): src is string => Boolean(src))
    .slice(0, 9);

  const sku = input.product.variants?.find((v) => v.sku?.trim())?.sku?.trim()
    || input.product.handle.toUpperCase();

  await db
    .update(auditsTable)
    .set({
      projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
      productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
      title,
      bulletPoints,
      imageUrls,
      targetKeywords: parseKeywords(title, bulletPoints),
      brandName: input.product.vendor?.trim() || null,
      category: input.product.product_type?.trim() || null,
      status: needsAudit ? "pending" : listing.auditStatus,
      updatedAt: new Date(),
    })
    .where(eq(auditsTable.id, input.auditId));

  await db
    .update(productProfilesTable)
    .set({
      sku,
      referenceLinks: listing.productUrl,
      notes: input.product.body_html ? stripHtml(input.product.body_html).slice(0, 2000) : null,
    })
    .where(eq(productProfilesTable.auditId, input.auditId));

  await db
    .update(productMarketplaceListingsTable)
    .set({
      status: listing.listingStatus,
      sku,
      priceCents: listing.priceCents,
      currency: listing.currency,
      inventory: listing.inventory,
      listingUrl: listing.productUrl,
      publishedAt: listing.publishedAt,
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, input.auditId),
      eq(productMarketplaceListingsTable.marketplace, "Shopify"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ));

  return { needsAudit };
}

export async function syncShopifyProducts(input: {
  storeUrl: string;
  ownerId: string;
  createdByUserId: string | null;
  workspaceId: number;
}): Promise<ShopifySyncResult> {
  const catalog = await fetchShopifyCatalogProducts(input.storeUrl);
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

  const limitedCatalog = catalog.slice(0, MAX_IMPORT);
  const existingAudits = await loadExistingShopifyAudits(
    input.workspaceId,
    limitedCatalog.map((product) => product.handle),
  );

  const origin = normalizeStoreOrigin(input.storeUrl);
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

  for (const product of limitedCatalog) {
    const handle = product.handle?.trim();
    const title = product.title?.trim();
    if (!handle || !title) {
      result.errors.push({ handle: handle || "unknown", error: "Missing product title or handle" });
      continue;
    }

    if (existingAudits.has(handle)) {
      const auditId = existingAudits.get(handle)!;
      try {
        const refresh = await refreshShopifyProductFromCatalog({
          auditId,
          workspaceId: input.workspaceId,
          product,
          origin,
        });
        if (refresh.needsAudit && !result.pendingAuditIds.includes(auditId)) {
          result.pendingAuditIds.push(auditId);
        }
        result.updated += 1;
      } catch (err) {
        result.errors.push({
          handle,
          error: err instanceof Error ? err.message : "Refresh failed",
        });
      }
      result.skipped += 1;
      continue;
    }

    try {
      const bulletPoints = parseBulletPoints(product.body_html, product.tags);
      const imageUrls = (product.images ?? [])
        .map((img) => img.src?.trim())
        .filter((src): src is string => Boolean(src))
        .slice(0, 9);
      const sku = product.variants?.find((v) => v.sku?.trim())?.sku?.trim() || handle.toUpperCase();
      const listing = resolveShopifyListingFields(product, origin);

      const [audit] = await db
        .insert(auditsTable)
        .values({
          userId: input.ownerId,
          createdByUserId: input.createdByUserId,
          workspaceId: input.workspaceId,
          projectName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          productName: title.split(/[|\-–—,]/)[0]?.trim() || title.slice(0, 60),
          asin: shopifyAsin(handle),
          brandName: product.vendor?.trim() || null,
          category: product.product_type?.trim() || null,
          title,
          bulletPoints,
          imageUrls,
          targetKeywords: parseKeywords(title, bulletPoints),
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
        notes: product.body_html ? stripHtml(product.body_html).slice(0, 2000) : null,
        workflowTemplate: DEFAULT_WORKFLOW_TEMPLATE,
        targetMarketplaces: ["Shopify"],
      });

      await db.insert(productMarketplaceListingsTable).values(
        TARGET_MARKETPLACES.map((marketplace) => ({
          auditId: audit.id,
          workspaceId: input.workspaceId,
          marketplace,
          status: marketplace === "Shopify" ? listing.listingStatus : "not_listed",
          sku: marketplace === "Shopify" ? sku : null,
          priceCents: marketplace === "Shopify" ? listing.priceCents : null,
          currency: listing.currency,
          listingUrl: marketplace === "Shopify" ? listing.productUrl : null,
          publishedAt: marketplace === "Shopify" ? listing.publishedAt : null,
          inventory: marketplace === "Shopify" ? listing.inventory : null,
        })),
      );

      existingAudits.set(handle, audit.id);
      result.imported += 1;
      result.pendingAuditIds.push(audit.id);
      result.products.push({
        id: audit.id,
        name: audit.projectName ?? audit.productName,
        sku,
        handle,
        detailUrl: `/products/${audit.id}`,
        workflowUrl: `/audits/workflow?resume=${audit.id}`,
      });
    } catch (err) {
      result.errors.push({
        handle,
        error: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  result.auditsQueued = result.pendingAuditIds.length;

  if (catalog.length > MAX_IMPORT) {
    result.errors.push({
      handle: "*",
      error: `Only the first ${MAX_IMPORT} products were processed. Run sync again after clearing duplicates or contact support for a higher limit.`,
    });
  }

  return result;
}
