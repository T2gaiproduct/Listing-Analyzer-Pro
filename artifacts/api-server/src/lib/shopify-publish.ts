import { and, eq } from "drizzle-orm";
import type { Audit, ImageRecord } from "@workspace/db";
import { db, productMarketplaceListingsTable, productProfilesTable } from "@workspace/db";
import { buildShopifyExportBundle, type ShopifyCsvRow } from "./shopify-listing-export.js";
import { shopifyHandleFromAsin } from "./shopify-import-utils.js";
import type { ShopifyStoreConnectionWithSecret } from "./marketplace-connections.js";
import {
  materializeAuditImagesForPublish,
  resolvePublishImageUrlsFromAudit,
} from "./materialize-audit-images-for-publish.js";
import {
  addProductToShopifyCollections,
  createShopifyProduct,
  clearShopifyAccessTokenCache,
  findShopifyProductByHandle,
  getOnlineStorePublicationId,
  getShopifyAccessToken,
  parseShopifyShopHost,
  publishProductToOnlineStore,
  shopifyProductGid,
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
  warning?: string;
  collectionsAssigned?: Array<{ id: string; title?: string }>;
};

function shopifyPublicationScopeMessage(): string {
  return "Product was saved in Shopify, but your app needs read_publications and write_publications API scopes to publish to the Online Store. Add those scopes in Shopify Dev Dashboard → API credentials, then reconnect on Marketplaces.";
}

function isShopifyPublicationAuthError(message: string): boolean {
  return /unauthorized|access denied|permission|scope|read_publications|write_publications/i.test(message);
}

async function tryPublishToOnlineStoreChannel(opts: {
  shopHost: string;
  accessToken: string;
  productGid: string;
}): Promise<{ published: boolean; warning?: string }> {
  try {
    const publicationId = await getOnlineStorePublicationId({
      shopHost: opts.shopHost,
      accessToken: opts.accessToken,
    });
    if (!publicationId) {
      return {
        published: false,
        warning: "Product was saved in Shopify, but the Online Store publication could not be found.",
      };
    }
    await publishProductToOnlineStore({
      shopHost: opts.shopHost,
      accessToken: opts.accessToken,
      productGid: opts.productGid,
      publicationId,
    });
    return { published: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isShopifyPublicationAuthError(message)) {
      return { published: false, warning: shopifyPublicationScopeMessage() };
    }
    return {
      published: false,
      warning: `Product was saved in Shopify, but Online Store publishing failed: ${message}`,
    };
  }
}

function shopifyProductUrl(shopHost: string, handle: string): string {
  return `https://${shopHost}/products/${handle}`;
}

function parseVariantPriceCents(product: ShopifyRestProduct): number | null {
  const raw = product.variants?.[0]?.price?.trim();
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function buildRestProductPayload(opts: {
  bundle: ReturnType<typeof buildShopifyExportBundle>;
  publishMode: ShopifyPublishMode;
  existingProductId?: number;
  existingVariants?: Array<{ id: number; sku?: string | null; price?: string | null }>;
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

  const targetSku = primary["Variant SKU"]?.trim();
  const existingVariant = opts.existingVariants?.find((variant) =>
    targetSku && variant.sku?.trim()
      ? variant.sku.trim() === targetSku
      : false,
  ) ?? opts.existingVariants?.[0];
  const bundlePrice = primary["Variant Price"]?.trim();
  const variantPrice = bundlePrice || existingVariant?.price || undefined;
  const isUpdate = Boolean(opts.existingProductId);

  const variantPayload: Record<string, unknown> = {
    ...(existingVariant?.id ? { id: existingVariant.id } : {}),
    sku: targetSku || existingVariant?.sku || undefined,
    ...(variantPrice ? { price: variantPrice } : {}),
  };

  if (!isUpdate) {
    variantPayload.inventory_policy = primary["Variant Inventory Policy"] || "deny";
    variantPayload.fulfillment_service = "manual";
    variantPayload.requires_shipping = primary["Variant Requires Shipping"] === "TRUE";
    variantPayload.taxable = primary["Variant Taxable"] === "TRUE";
    variantPayload.option1 = primary["Option1 Value"] || "Default Title";
  }

  const payload: Record<string, unknown> = {
    title: primary.Title,
    body_html: primary["Body (HTML)"],
    vendor: primary.Vendor || undefined,
    product_type: primary.Type || undefined,
    tags: primary.Tags || undefined,
    handle: primary.Handle,
    status: opts.publishMode === "live" ? "active" : "draft",
    published_at: opts.publishMode === "live" ? new Date().toISOString() : null,
    variants: [variantPayload],
    images,
    metafields_global_title_tag: primary["SEO Title"] || undefined,
    metafields_global_description_tag: primary["SEO Description"] || undefined,
  };

  if (!isUpdate) {
    payload.options = [
      {
        name: primary["Option1 Name"] || "Title",
        values: [primary["Option1 Value"] || "Default Title"],
      },
    ];
  }

  if (opts.existingProductId) {
    payload.id = opts.existingProductId;
  }

  return payload;
}

function emptyShopifyImageRow(handle: string): ShopifyCsvRow {
  return {
    Handle: handle,
    Title: "",
    "Body (HTML)": "",
    Vendor: "",
    Type: "",
    Tags: "",
    Published: "",
    "Option1 Name": "",
    "Option1 Value": "",
    "Variant SKU": "",
    "Variant Grams": "",
    "Variant Inventory Tracker": "",
    "Variant Inventory Qty": "",
    "Variant Inventory Policy": "",
    "Variant Fulfillment Service": "",
    "Variant Price": "",
    "Variant Compare At Price": "",
    "Variant Requires Shipping": "",
    "Variant Taxable": "",
    "Variant Barcode": "",
    "Image Src": "",
    "Image Position": "",
    "Image Alt Text": "",
    "Gift Card": "",
    "SEO Title": "",
    "SEO Description": "",
    Status: "",
  };
}

/** Rebuild bundle image rows from all publishable URLs (audit + graphics project). */
function applyResolvedPublishImagesToBundle(
  bundle: ReturnType<typeof buildShopifyExportBundle>,
  opts: {
    audit: Audit;
    graphicsImageRecords?: ImageRecord[];
    graphicsProjectId?: number | null;
    publicBaseUrl?: string;
  },
): ReturnType<typeof buildShopifyExportBundle> {
  const resolvedUrls = resolvePublishImageUrlsFromAudit({
    audit: opts.audit,
    graphicsImageRecords: opts.graphicsImageRecords,
    graphicsProjectId: opts.graphicsProjectId,
    publicBaseUrl: opts.publicBaseUrl,
  });
  if (resolvedUrls.length === 0) return bundle;

  const primary = bundle.rows[0];
  if (!primary) return bundle;

  const handle = primary.Handle;
  const altText = primary["Image Alt Text"]?.trim() || primary.Title?.trim() || undefined;
  const rows: ShopifyCsvRow[] = resolvedUrls.map((src, index) => {
    if (index === 0) {
      return {
        ...primary,
        "Image Src": src,
        "Image Position": "1",
        "Image Alt Text": altText ?? primary["Image Alt Text"],
      };
    }
    return {
      ...emptyShopifyImageRow(handle),
      "Image Src": src,
      "Image Position": String(index + 1),
    };
  });

  return { ...bundle, rows };
}

export async function publishListingToShopify(opts: {
  connection: ShopifyStoreConnectionWithSecret;
  audit: Audit;
  graphicsImageRecords?: ImageRecord[];
  graphicsProjectId?: number | null;
  publicBaseUrl?: string;
  publishMode?: ShopifyPublishMode;
  /** Shopify collection GIDs (custom collections only). Amazon/other marketplaces unchanged. */
  shopifyCollectionGids?: string[];
  shopifyCollectionTitles?: Record<string, string>;
}): Promise<ShopifyPublishResult> {
  const publishMode = opts.publishMode ?? "draft";
  const audit = await materializeAuditImagesForPublish(opts.audit);
  const shopHost = parseShopifyShopHost(opts.connection.storeUrl);
  const fetchAccessToken = async () => getShopifyAccessToken({
    shopHost,
    clientId: opts.connection.clientId,
    clientSecret: opts.connection.clientSecret,
  });
  let accessToken: string;
  try {
    accessToken = await fetchAccessToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/unauthorized|invalid/i.test(message)) throw err;
    clearShopifyAccessTokenCache({ shopHost, clientId: opts.connection.clientId });
    accessToken = await fetchAccessToken();
  }

  const [profile] = await db
    .select({ sku: productProfilesTable.sku })
    .from(productProfilesTable)
    .where(eq(productProfilesTable.auditId, audit.id))
    .limit(1);

  const [shopifyListing] = await db
    .select({
      priceCents: productMarketplaceListingsTable.priceCents,
      currency: productMarketplaceListingsTable.currency,
      sku: productMarketplaceListingsTable.sku,
    })
    .from(productMarketplaceListingsTable)
    .where(and(
      eq(productMarketplaceListingsTable.auditId, audit.id),
      eq(productMarketplaceListingsTable.marketplace, "Shopify"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .limit(1);

  const variantSku = profile?.sku?.trim()
    || shopifyListing?.sku?.trim()
    || `SL-${audit.id}`;
  const variantPrice = shopifyListing?.priceCents != null && shopifyListing.priceCents > 0
    ? (shopifyListing.priceCents / 100).toFixed(2)
    : "";
  const listingCurrency = shopifyListing?.currency?.trim() || "USD";

  const bundle = applyResolvedPublishImagesToBundle(
    buildShopifyExportBundle({
      audit,
      graphicsImageRecords: opts.graphicsImageRecords,
      publicBaseUrl: opts.publicBaseUrl,
      variantSku,
      variantPrice,
    }),
    {
      audit,
      graphicsImageRecords: opts.graphicsImageRecords,
      graphicsProjectId: opts.graphicsProjectId,
      publicBaseUrl: opts.publicBaseUrl,
    },
  );

  const importedHandle = shopifyHandleFromAsin(audit.asin);
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
    existingVariants: existing?.variants,
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

  const productGid = product.admin_graphql_api_id ?? shopifyProductGid(product.id);

  let collectionWarning: string | undefined;
  let collectionsAssigned: Array<{ id: string; title?: string }> = [];
  const collectionGids = (opts.shopifyCollectionGids ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  if (collectionGids.length > 0) {
    const collectionResult = await addProductToShopifyCollections({
      shopHost,
      accessToken,
      productGid,
      collectionGids,
    });
    collectionsAssigned = collectionResult.assigned.map((id) => ({
      id,
      title: opts.shopifyCollectionTitles?.[id],
    }));
    if (collectionResult.warnings.length > 0) {
      collectionWarning = `Some Shopify collections could not be updated: ${collectionResult.warnings.join("; ")}`;
    }
  }

  let channelWarning: string | undefined;
  if (publishMode === "live") {
    const channelResult = await tryPublishToOnlineStoreChannel({
      shopHost,
      accessToken,
      productGid,
    });
    if (!channelResult.published) {
      channelWarning = channelResult.warning;
    }
  }

  const combinedWarning = [collectionWarning, channelWarning].filter(Boolean).join(" ") || undefined;

  const listingUrl = shopifyProductUrl(shopHost, product.handle || handle);
  const listingStatus = publishMode === "live" && !channelWarning ? "live" : "pending";
  const sku = variantSku;
  const priceRaw = bundle.rows[0]?.["Variant Price"]?.trim();
  const sentPriceCents = priceRaw && !Number.isNaN(Number(priceRaw))
    ? Math.round(Number(priceRaw) * 100)
    : null;
  const responsePriceCents = parseVariantPriceCents(product);
  const priceCents = responsePriceCents != null && responsePriceCents > 0
    ? responsePriceCents
    : sentPriceCents != null && sentPriceCents > 0
      ? sentPriceCents
      : shopifyListing?.priceCents != null && shopifyListing.priceCents > 0
        ? shopifyListing.priceCents
        : null;

  const listingUpdate = await db
    .update(productMarketplaceListingsTable)
    .set({
      status: listingStatus,
      sku,
      priceCents,
      currency: listingCurrency,
      listingUrl,
      publishedAt: publishMode === "live" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(productMarketplaceListingsTable.auditId, audit.id),
      eq(productMarketplaceListingsTable.marketplace, "Shopify"),
      eq(productMarketplaceListingsTable.isDeleted, 0),
    ))
    .returning({ id: productMarketplaceListingsTable.id });

  if (listingUpdate.length === 0 && audit.workspaceId) {
    await db.insert(productMarketplaceListingsTable).values({
      auditId: audit.id,
      workspaceId: audit.workspaceId,
      marketplace: "Shopify",
      status: listingStatus,
      sku,
      priceCents,
      currency: listingCurrency,
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
    warning: combinedWarning,
    collectionsAssigned: collectionsAssigned.length > 0 ? collectionsAssigned : undefined,
  };
}
