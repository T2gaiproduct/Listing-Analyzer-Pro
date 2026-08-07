import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable } from "@workspace/db";
import { buildShopifyExportBundle } from "./shopify-listing-export.js";
import { shopifyHandleFromAsin } from "./shopify-import-utils.js";
import type { ShopifyStoreConnectionWithSecret } from "./marketplace-connections.js";
import {
  createShopifyProduct,
  findShopifyProductByHandle,
  getShopifyAccessToken,
  parseShopifyShopHost,
  updateShopifyProduct,
  type ShopifyRestProduct,
} from "./shopify-admin-client.js";

export type ShopifyPublishMode = "draft" | "live";

export type ShopifyPublishResult = {
  productId: number;
  handle: string;
  listingUrl: string;
  status: "live" | "pending";
  created: boolean;
};

function shopifyProductUrl(shopHost: string, handle: string): string {
  return `https://${shopHost}/products/${handle}`;
}

function buildRestProductPayload(opts: {
  bundle: ReturnType<typeof buildShopifyExportBundle>;
  publishMode: ShopifyPublishMode;
  existingProductId?: number;
}): Record<string, unknown> {
  const primary = opts.bundle.rows[0];
  if (!primary) throw new Error("Export bundle is empty");

  const images = opts.bundle.rows
    .map((row) => row["Image Src"]?.trim())
    .filter((src): src is string => Boolean(src))
    .map((src, index) => ({
      src,
      position: index + 1,
      alt: primary["Image Alt Text"]?.trim() || primary.Title?.trim() || undefined,
    }));

  const payload: Record<string, unknown> = {
    title: primary.Title,
    body_html: primary["Body (HTML)"],
    vendor: primary.Vendor || undefined,
    product_type: primary.Type || undefined,
    tags: primary.Tags || undefined,
    handle: primary.Handle,
    status: opts.publishMode === "live" ? "active" : "draft",
    variants: [
      {
        sku: primary["Variant SKU"] || undefined,
        price: primary["Variant Price"] || "0.00",
        inventory_policy: primary["Variant Inventory Policy"] || "deny",
        fulfillment_service: "manual",
        requires_shipping: primary["Variant Requires Shipping"] === "TRUE",
        taxable: primary["Variant Taxable"] === "TRUE",
        option1: primary["Option1 Value"] || "Default Title",
      },
    ],
    options: [
      {
        name: primary["Option1 Name"] || "Title",
        values: [primary["Option1 Value"] || "Default Title"],
      },
    ],
    images,
    metafields_global_title_tag: primary["SEO Title"] || undefined,
    metafields_global_description_tag: primary["SEO Description"] || undefined,
  };

  if (opts.existingProductId) {
    payload.id = opts.existingProductId;
  }

  return payload;
}

export async function publishListingToShopify(opts: {
  connection: ShopifyStoreConnectionWithSecret;
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  publicBaseUrl?: string;
  publishMode?: ShopifyPublishMode;
}): Promise<ShopifyPublishResult> {
  const publishMode = opts.publishMode ?? "draft";
  const shopHost = parseShopifyShopHost(opts.connection.storeUrl);
  const accessToken = await getShopifyAccessToken({
    shopHost,
    clientId: opts.connection.clientId,
    clientSecret: opts.connection.clientSecret,
  });

  const bundle = buildShopifyExportBundle({
    audit: opts.audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    publicBaseUrl: opts.publicBaseUrl,
  });

  const importedHandle = shopifyHandleFromAsin(opts.audit.asin);
  const handle = importedHandle ?? bundle.rows[0]?.Handle;
  if (!handle) throw new Error("Could not resolve Shopify product handle");

  if (bundle.rows[0]) {
    bundle.rows[0].Handle = handle;
    for (let i = 1; i < bundle.rows.length; i += 1) {
      bundle.rows[i]!.Handle = handle;
    }
  }

  const existing = await findShopifyProductByHandle({ shopHost, accessToken, handle });
  const payload = buildRestProductPayload({
    bundle,
    publishMode,
    existingProductId: existing?.id,
  });

  let product: ShopifyRestProduct;
  let created = false;
  if (existing?.id) {
    product = await updateShopifyProduct({
      shopHost,
      accessToken,
      productId: existing.id,
      product: payload,
    });
  } else {
    product = await createShopifyProduct({
      shopHost,
      accessToken,
      product: payload,
    });
    created = true;
  }

  const listingUrl = shopifyProductUrl(shopHost, product.handle || handle);
  const listingStatus = publishMode === "live" ? "live" : "pending";
  const sku = bundle.rows[0]?.["Variant SKU"]?.trim() || `SL-${opts.audit.id}`;
  const priceRaw = bundle.rows[0]?.["Variant Price"]?.trim();
  const priceCents = priceRaw && !Number.isNaN(Number(priceRaw))
    ? Math.round(Number(priceRaw) * 100)
    : null;

  const listingUpdate = await db
    .update(productMarketplaceListingsTable)
    .set({
      status: listingStatus,
      sku,
      priceCents,
      currency: "INR",
      listingUrl,
      publishedAt: publishMode === "live" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, opts.audit.id),
      eq(productMarketplaceListingsTable.marketplace, "Shopify"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .returning({ id: productMarketplaceListingsTable.id });

  if (listingUpdate.length === 0 && opts.audit.workspaceId) {
    await db.insert(productMarketplaceListingsTable).values({
      auditId: opts.audit.id,
      workspaceId: opts.audit.workspaceId,
      marketplace: "Shopify",
      status: listingStatus,
      sku,
      priceCents,
      currency: "INR",
      listingUrl,
      publishedAt: publishMode === "live" ? new Date() : null,
    });
  }

  return {
    productId: product.id,
    handle: product.handle || handle,
    listingUrl,
    status: listingStatus,
    created,
  };
}
