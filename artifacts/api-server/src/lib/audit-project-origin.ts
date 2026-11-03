import {
  classifyAuditProductSource,
  type AuditProductSourceType,
} from "./audit-product-source.js";

export const PROJECT_ORIGIN_AUDIT_LISTING = "audit_listing";
export const PROJECT_ORIGIN_BUILD_BRAND_SCRATCH = "build_brand_scratch";
export const PROJECT_ORIGIN_BUILD_BRAND_IMPORT = "build_brand_import";

export type ProjectOrigin =
  | typeof PROJECT_ORIGIN_AUDIT_LISTING
  | typeof PROJECT_ORIGIN_BUILD_BRAND_SCRATCH
  | typeof PROJECT_ORIGIN_BUILD_BRAND_IMPORT;

export type ImportMarketplaceId = "amazon" | "shopify" | "woocommerce" | "ebay" | "walmart";

const IMPORT_MARKETPLACE_LABELS: Record<ImportMarketplaceId, string> = {
  amazon: "Import from Amazon",
  shopify: "Import from Shopify",
  woocommerce: "Import from WooCommerce",
  ebay: "Import from eBay",
  walmart: "Import from Walmart",
};

function parseImportMarketplace(raw: unknown): ImportMarketplaceId | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value in IMPORT_MARKETPLACE_LABELS) return value as ImportMarketplaceId;
  return null;
}

export function parseProjectOriginFromBody(body: unknown): ProjectOrigin | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { projectOrigin?: unknown }).projectOrigin;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (
    value === PROJECT_ORIGIN_AUDIT_LISTING
    || value === PROJECT_ORIGIN_BUILD_BRAND_SCRATCH
    || value === PROJECT_ORIGIN_BUILD_BRAND_IMPORT
  ) {
    return value;
  }
  return null;
}

export function parseImportMarketplaceFromBody(body: unknown): ImportMarketplaceId | null {
  if (!body || typeof body !== "object") return null;
  return parseImportMarketplace((body as { importMarketplace?: unknown }).importMarketplace);
}

export function projectOriginInsertFields(
  body: unknown,
  fallback: ProjectOrigin | null,
): { projectOrigin: string | null; importMarketplace: string | null } {
  const projectOrigin = parseProjectOriginFromBody(body) ?? fallback;
  const importMarketplace =
    projectOrigin === PROJECT_ORIGIN_BUILD_BRAND_IMPORT
      ? parseImportMarketplaceFromBody(body)
      : null;
  return {
    projectOrigin,
    importMarketplace,
  };
}

export function importMarketplaceLabel(id: ImportMarketplaceId | string | null | undefined): string {
  if (!id) return "Import from link";
  const parsed = parseImportMarketplace(id);
  return parsed ? IMPORT_MARKETPLACE_LABELS[parsed] : "Import from link";
}

export type ProductExplorerAuditClassification = {
  sourceType: AuditProductSourceType;
  sourceTypeLabel: string;
  isAuditListing: boolean;
  isShopifyImport: boolean;
  isWooCommerceImport: boolean;
  isEbayImport: boolean;
};

/** Product Explorer / recents type column — prefers stored projectOrigin over ASIN heuristics. */
export function classifyAuditForProductExplorer(opts: {
  projectOrigin: string | null | undefined;
  importMarketplace: string | null | undefined;
  asin: string | null | undefined;
  hasProductProfile: boolean;
}): ProductExplorerAuditClassification {
  const legacy = classifyAuditProductSource({
    asin: opts.asin,
    hasProductProfile: opts.hasProductProfile,
  });

  const origin = opts.projectOrigin?.trim();
  if (origin === PROJECT_ORIGIN_AUDIT_LISTING) {
    return {
      sourceType: "audit",
      sourceTypeLabel: "Audit Listing",
      isAuditListing: true,
      isShopifyImport: false,
      isWooCommerceImport: false,
      isEbayImport: false,
    };
  }
  if (origin === PROJECT_ORIGIN_BUILD_BRAND_SCRATCH) {
    return {
      sourceType: "listing",
      sourceTypeLabel: "Build Your Brand",
      isAuditListing: false,
      isShopifyImport: false,
      isWooCommerceImport: false,
      isEbayImport: false,
    };
  }
  if (origin === PROJECT_ORIGIN_BUILD_BRAND_IMPORT) {
    const mp = parseImportMarketplace(opts.importMarketplace);
    return {
      sourceType: "listing",
      sourceTypeLabel: mp ? IMPORT_MARKETPLACE_LABELS[mp] : "Import from link",
      isAuditListing: false,
      isShopifyImport: mp === "shopify",
      isWooCommerceImport: mp === "woocommerce",
      isEbayImport: mp === "ebay",
    };
  }

  return {
    sourceType: legacy.sourceType,
    sourceTypeLabel: legacy.isShopifyImport
      ? "Shopify Import"
      : legacy.isWooCommerceImport
        ? "WooCommerce Import"
        : legacy.isEbayImport
          ? "eBay Import"
          : legacy.sourceType === "audit"
            ? "Audit Listing"
            : "Build Your Brand",
    isAuditListing: legacy.isAuditListing,
    isShopifyImport: legacy.isShopifyImport,
    isWooCommerceImport: legacy.isWooCommerceImport,
    isEbayImport: legacy.isEbayImport,
  };
}
