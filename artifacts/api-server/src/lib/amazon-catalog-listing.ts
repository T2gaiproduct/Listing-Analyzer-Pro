import type { FetchedListing, FetchedListingAttribute } from "./amazon-fetcher.js";
import {
  cleanAmazonListingLine,
  normalizeAmazonAttributes,
  normalizeAmazonBulletPoints,
  normalizeAmazonDescription,
} from "./listing-text-normalize.js";
import { getCatalogItemByAsin } from "./amazon-sp-api.js";
import type { ResolvedAmazonConnection } from "./resolve-amazon-settings.js";
import { resolveAmazonMarketplaceCodeFromProductUrl } from "./amazon-marketplaces.js";
import { resolveMarketplaceCodeFromSpId } from "./amazon-sp-settings.js";

type CatalogAttributeEntry = Record<string, unknown>;

function humanizeCatalogAttributeKey(key: string): string {
  const stripped = key.replace(/^\d+$/, "").trim();
  const base = stripped
    .replace(/_/g, " ")
    .replace(/\b(bullet point)(\d+)\b/i, "Bullet point $2")
    .trim();
  if (!base) return key;
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDimensionObject(obj: Record<string, unknown>): string | null {
  const parts: string[] = [];
  for (const [dimKey, dimVal] of Object.entries(obj)) {
    if (dimVal && typeof dimVal === "object" && "value" in (dimVal as object)) {
      const unit = (dimVal as { unit?: string }).unit ?? "";
      const value = (dimVal as { value?: number | string }).value;
      if (value != null && String(value).trim()) {
        parts.push(`${dimKey.replace(/_/g, " ")}: ${value}${unit ? ` ${unit}` : ""}`);
      }
    }
  }
  return parts.length ? parts.join(", ") : null;
}

function extractCatalogEntryText(entry: unknown): string | null {
  if (entry == null) return null;
  if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
    const text = cleanAmazonListingLine(String(entry), 500);
    return text || null;
  }
  if (typeof entry !== "object") return null;

  const obj = entry as CatalogAttributeEntry;
  if (typeof obj.value === "string" || typeof obj.value === "number") {
    const text = cleanAmazonListingLine(String(obj.value), 500);
    return text || null;
  }
  if (Array.isArray(obj.value)) {
    const joined = obj.value
      .map((v) => extractCatalogEntryText(v))
      .filter(Boolean)
      .join(", ");
    return joined ? cleanAmazonListingLine(joined, 500) : null;
  }

  const dimensionText = formatDimensionObject(obj);
  if (dimensionText) return cleanAmazonListingLine(dimensionText, 500);

  if (typeof obj.media_location === "string") {
    return cleanAmazonListingLine(obj.media_location, 500);
  }

  return null;
}

export function catalogAttributesToRows(
  attributes: Record<string, unknown> | undefined | null,
): FetchedListingAttribute[] {
  if (!attributes || typeof attributes !== "object") return [];

  const rows: FetchedListingAttribute[] = [];
  const push = (attribute: string, value: string) => {
    const a = cleanAmazonListingLine(attribute, 120);
    const v = cleanAmazonListingLine(value, 500);
    if (!a || !v) return;
    rows.push({ attribute: a, value: v });
  };

  for (const [key, rawEntries] of Object.entries(attributes)) {
    if (!Array.isArray(rawEntries)) continue;
    const values: string[] = [];
    for (const entry of rawEntries) {
      const text = extractCatalogEntryText(entry);
      if (text) values.push(text);
    }
    if (!values.length) continue;

    const label = humanizeCatalogAttributeKey(key);
    if (/^bullet point/i.test(label)) continue;
    push(label, [...new Set(values)].join("; "));
  }

  return normalizeAmazonAttributes(rows);
}

function extractBulletsFromCatalogAttributes(
  attributes: Record<string, unknown> | undefined | null,
): string[] {
  if (!attributes) return [];
  const bullets: string[] = [];
  for (const [key, rawEntries] of Object.entries(attributes)) {
    if (!/^bullet_point/i.test(key)) continue;
    if (!Array.isArray(rawEntries)) continue;
    for (const entry of rawEntries) {
      const text = extractCatalogEntryText(entry);
      if (text) bullets.push(text);
    }
  }
  return normalizeAmazonBulletPoints(bullets);
}

function extractImagesFromCatalogPayload(payload: {
  images?: Array<{ images?: Array<{ link?: string; variant?: string }> }>;
}): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const group of payload.images ?? []) {
    for (const img of group.images ?? []) {
      const link = img.link?.trim();
      if (!link || !link.startsWith("http") || seen.has(link)) continue;
      seen.add(link);
      urls.push(link);
    }
  }
  return urls.slice(0, 9);
}

function pickSummaryForMarketplace(
  summaries: Array<Record<string, unknown>> | undefined,
  marketplaceCode: string,
): Record<string, unknown> | null {
  if (!summaries?.length) return null;
  const code = marketplaceCode.toUpperCase();
  const match = summaries.find((s) => {
    const spId = typeof s.marketplaceId === "string" ? s.marketplaceId : "";
    return resolveMarketplaceCodeFromSpId(spId) === code;
  });
  return match ?? summaries[0] ?? null;
}

function mergeAttributeRows(
  primary: FetchedListingAttribute[],
  secondary: FetchedListingAttribute[],
): FetchedListingAttribute[] {
  if (!primary.length) return secondary;
  if (!secondary.length) return primary;
  const seen = new Set(primary.map((r) => r.attribute.toLowerCase()));
  const merged = [...primary];
  for (const row of secondary) {
    const key = row.attribute.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return normalizeAmazonAttributes(merged);
}

export async function enrichAmazonListingFromCatalog(opts: {
  listing: FetchedListing;
  marketplaceCode: string;
  connection: ResolvedAmazonConnection;
}): Promise<FetchedListing & { attributesSource?: "sp_api_catalog" | "scrape" | "mixed" }> {
  const asin = opts.listing.asin?.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return opts.listing;

  let catalogPayload: Awaited<ReturnType<typeof getCatalogItemByAsin>>;
  try {
    catalogPayload = await getCatalogItemByAsin({
      settings: opts.connection.settings,
      refreshToken: opts.connection.refreshToken,
      asin,
      marketplaceCode: opts.marketplaceCode,
    });
  } catch {
    return opts.listing;
  }

  const catalogAttrs = catalogAttributesToRows(catalogPayload.attributes);
  const scrapeAttrs = opts.listing.attributes ?? [];
  const mergedAttrs = mergeAttributeRows(catalogAttrs, scrapeAttrs);

  const summary = pickSummaryForMarketplace(
    catalogPayload.summaries as Array<Record<string, unknown>> | undefined,
    opts.marketplaceCode,
  );

  let title = opts.listing.title;
  if (!title?.trim() && typeof summary?.itemName === "string") {
    title = cleanAmazonListingLine(summary.itemName, 500);
  }

  let bulletPoints = opts.listing.bulletPoints ?? [];
  if (bulletPoints.length === 0) {
    bulletPoints = extractBulletsFromCatalogAttributes(catalogPayload.attributes);
  }

  let imageUrls = opts.listing.imageUrls ?? [];
  if (imageUrls.length === 0) {
    imageUrls = extractImagesFromCatalogPayload(catalogPayload);
  }

  let description = opts.listing.description;
  if (!description) {
    const descFromAttrs = catalogPayload.attributes?.product_description;
    if (Array.isArray(descFromAttrs)) {
      const parts = descFromAttrs
        .map((e) => extractCatalogEntryText(e))
        .filter(Boolean) as string[];
      description = normalizeAmazonDescription(parts.join("\n\n"));
    }
  }

  const attributesSource: "sp_api_catalog" | "scrape" | "mixed" =
    catalogAttrs.length === 0
      ? "scrape"
      : scrapeAttrs.length === 0
        ? "sp_api_catalog"
        : "mixed";

  return {
    ...opts.listing,
    title: title || opts.listing.title,
    bulletPoints,
    imageUrls,
    description: description ?? opts.listing.description,
    attributes: mergedAttrs,
    attributesSource: catalogAttrs.length > 0 ? attributesSource : undefined,
  };
}

export function resolveMarketplaceCodeForAmazonListing(input: {
  url?: string;
  connection?: ResolvedAmazonConnection | null;
}): string {
  if (input.url?.trim()) {
    return resolveAmazonMarketplaceCodeFromProductUrl(input.url);
  }
  const sellerDefault = input.connection?.marketplaceIds?.[0];
  if (sellerDefault) {
    return resolveMarketplaceCodeFromSpId(sellerDefault);
  }
  const settingsDefault = input.connection?.settings.defaultMarketplace?.trim().toUpperCase();
  if (settingsDefault) return settingsDefault;
  return "US";
}
