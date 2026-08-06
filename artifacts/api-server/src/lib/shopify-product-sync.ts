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
  tags?: string;
  images?: Array<{ src?: string }>;
  variants?: Array<{ sku?: string; price?: string }>;
};

export type ShopifySyncResult = {
  imported: number;
  skipped: number;
  total: number;
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

function parseBulletPoints(bodyHtml: string | undefined, tags: string | undefined): string[] {
  const bulletPoints: string[] = [];

  if (bodyHtml) {
    const description = stripHtml(bodyHtml);
    const sentences = description
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 300);
    bulletPoints.push(...sentences.slice(0, 5));
  }

  if (tags) {
    for (const tag of tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3)) {
      if (tag.length > 3) bulletPoints.push(tag);
    }
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

async function loadExistingShopifyHandles(workspaceId: number, handles: string[]): Promise<Set<string>> {
  if (handles.length === 0) return new Set();

  const asins = handles.map(shopifyAsin);
  const rows = await db
    .select({ asin: auditsTable.asin })
    .from(auditsTable)
    .where(
      and(
        eq(auditsTable.workspaceId, workspaceId),
        eq(auditsTable.isDeleted, 0),
        inArray(auditsTable.asin, asins),
      ),
    );

  return new Set(
    rows
      .map((row) => row.asin?.replace(/^shopify:/, ""))
      .filter((handle): handle is string => Boolean(handle)),
  );
}

export async function syncShopifyProducts(input: {
  storeUrl: string;
  ownerId: string;
  createdByUserId: string | null;
  workspaceId: number;
}): Promise<ShopifySyncResult> {
  const catalog = await fetchShopifyCatalogProducts(input.storeUrl);
  if (catalog.length === 0) {
    return { imported: 0, skipped: 0, total: 0, products: [], errors: [] };
  }

  const limitedCatalog = catalog.slice(0, MAX_IMPORT);
  const existingHandles = await loadExistingShopifyHandles(
    input.workspaceId,
    limitedCatalog.map((product) => product.handle),
  );

  const origin = normalizeStoreOrigin(input.storeUrl);
  const result: ShopifySyncResult = {
    imported: 0,
    skipped: 0,
    total: catalog.length,
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

    if (existingHandles.has(handle)) {
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
      const priceRaw = product.variants?.[0]?.price;
      const priceCents = priceRaw ? Math.round(parseFloat(priceRaw) * 100) : null;
      const productUrl = `${origin}/products/${handle}`;

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
          status: "draft",
          currentStep: 1,
        })
        .returning();

      await db.insert(productProfilesTable).values({
        auditId: audit.id,
        sku,
        priority: "medium",
        referenceLinks: productUrl,
        notes: product.body_html ? stripHtml(product.body_html).slice(0, 2000) : null,
        workflowTemplate: DEFAULT_WORKFLOW_TEMPLATE,
        targetMarketplaces: ["Shopify"],
      });

      await db.insert(productMarketplaceListingsTable).values(
        TARGET_MARKETPLACES.map((marketplace) => ({
          auditId: audit.id,
          workspaceId: input.workspaceId,
          marketplace,
          status: marketplace === "Shopify" ? "live" : "not_listed",
          sku: marketplace === "Shopify" ? sku : null,
          priceCents: marketplace === "Shopify" ? priceCents : null,
          currency: "USD",
          listingUrl: marketplace === "Shopify" ? productUrl : null,
          publishedAt: marketplace === "Shopify" ? new Date() : null,
        })),
      );

      existingHandles.add(handle);
      result.imported += 1;
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

  if (catalog.length > MAX_IMPORT) {
    result.errors.push({
      handle: "*",
      error: `Only the first ${MAX_IMPORT} products were processed. Run sync again after clearing duplicates or contact support for a higher limit.`,
    });
  }

  return result;
}
