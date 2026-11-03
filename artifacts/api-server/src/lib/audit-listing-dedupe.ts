import { and, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { auditsTable, db } from "@workspace/db";
import {
  PROJECT_ORIGIN_AUDIT_LISTING,
  PROJECT_ORIGIN_BUILD_BRAND_IMPORT,
} from "./audit-project-origin.js";

/** Audit Listing and Import from link are the same “link/ASIN” bucket for dedupe. */
const LINK_IMPORT_DEDUPE_ORIGINS = new Set([
  PROJECT_ORIGIN_AUDIT_LISTING,
  PROJECT_ORIGIN_BUILD_BRAND_IMPORT,
]);

function extractAmazonAsinFromUrl(href: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i,
    /\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i,
    /\/product\/([A-Z0-9]{10})(?:[/?]|$)/i,
  ];
  for (const re of patterns) {
    const m = href.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return null;
}

/** Host + path identity for non-Amazon URLs (Shopify, WooCommerce, etc.). */
export function canonicalListingUrlKey(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  try {
    const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const amazonAsin = extractAmazonAsinFromUrl(href);
    if (amazonAsin) return `asin:${amazonAsin.toLowerCase()}`;

    const url = new URL(href);
    url.hash = "";
    url.search = "";
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `url:${url.hostname.toLowerCase()}${path}`;
  } catch {
    return `url:${trimmed.toLowerCase()}`;
  }
}

/** All keys that identify the same catalog listing (ASIN + URL variants). */
export function listingIdentityKeys(
  asin?: string | null,
  sourceListingUrl?: string | null,
): string[] {
  const keys = new Set<string>();
  const trimmedAsin = asin?.trim();
  if (trimmedAsin) keys.add(`asin:${trimmedAsin.toLowerCase()}`);

  const urlRaw = sourceListingUrl?.trim();
  if (urlRaw) {
    const href = urlRaw.startsWith("http") ? urlRaw : `https://${urlRaw}`;
    const amazonFromUrl = extractAmazonAsinFromUrl(href);
    if (amazonFromUrl) keys.add(`asin:${amazonFromUrl.toLowerCase()}`);

    const canonical = canonicalListingUrlKey(urlRaw);
    if (canonical) keys.add(canonical);
  }

  return [...keys];
}

/** @deprecated Use listingIdentityKeys — first key if any. */
export function listingCatalogKey(
  asin?: string | null,
  sourceListingUrl?: string | null,
): string | null {
  const keys = listingIdentityKeys(asin, sourceListingUrl);
  return keys[0] ?? null;
}

export function coalesceListingAsin(
  asin?: string | null,
  sourceListingUrl?: string | null,
): string | null {
  const trimmed = asin?.trim();
  if (trimmed) return trimmed;
  const urlRaw = sourceListingUrl?.trim();
  if (!urlRaw) return null;
  const href = urlRaw.startsWith("http") ? urlRaw : `https://${urlRaw}`;
  return extractAmazonAsinFromUrl(href);
}

function readSourceUrlFromAudit(audit: typeof auditsTable.$inferSelect): string | null {
  const slots = audit.referenceResearch?.slots;
  if (Array.isArray(slots) && slots.length > 0) {
    const first = slots[0];
    if (first && typeof first === "object" && typeof first.url === "string" && first.url.trim()) {
      return first.url.trim();
    }
  }
  return null;
}

function originMatchesScope(
  rowOrigin: string | null | undefined,
  requestedOrigin: string,
): boolean {
  const row = rowOrigin?.trim() ?? "";
  const requested = requestedOrigin.trim();
  if (row === requested) return true;
  if (!row) return true;
  if (
    LINK_IMPORT_DEDUPE_ORIGINS.has(row as typeof PROJECT_ORIGIN_AUDIT_LISTING)
    && LINK_IMPORT_DEDUPE_ORIGINS.has(requested as typeof PROJECT_ORIGIN_AUDIT_LISTING)
  ) {
    return true;
  }
  return false;
}

function dedupeOriginWhere(requestedOrigin: string): SQL {
  const requested = requestedOrigin.trim();
  if (LINK_IMPORT_DEDUPE_ORIGINS.has(requested as typeof PROJECT_ORIGIN_AUDIT_LISTING)) {
    return or(
      isNull(auditsTable.projectOrigin),
      eq(auditsTable.projectOrigin, PROJECT_ORIGIN_AUDIT_LISTING),
      eq(auditsTable.projectOrigin, PROJECT_ORIGIN_BUILD_BRAND_IMPORT),
    )!;
  }
  return or(isNull(auditsTable.projectOrigin), eq(auditsTable.projectOrigin, requested))!;
}

/** When reusing a row, only set origin if the existing row has none (legacy). */
export function originFieldsPatchOnReuse(
  existing: { projectOrigin: string | null | undefined },
  requested: { projectOrigin: string | null; importMarketplace: string | null },
): { projectOrigin: string | null; importMarketplace: string | null } | undefined {
  if (existing.projectOrigin?.trim()) return undefined;
  if (!requested.projectOrigin?.trim()) return undefined;
  return requested;
}

export async function findReusableListingAudit(
  scopeWhere: SQL | undefined,
  opts: {
    projectOrigin: string | null;
    asin?: string | null;
    sourceListingUrl?: string | null;
  },
): Promise<(typeof auditsTable.$inferSelect) | null> {
  const origin = opts.projectOrigin?.trim();
  if (!origin) return null;

  const requestKeys = listingIdentityKeys(
    coalesceListingAsin(opts.asin, opts.sourceListingUrl) ?? opts.asin,
    opts.sourceListingUrl,
  );
  if (requestKeys.length === 0) return null;

  const notArchived = sql`${auditsTable.status} != 'archived'`;

  const asinKeys = requestKeys
    .filter((k) => k.startsWith("asin:"))
    .map((k) => k.slice("asin:".length));

  if (asinKeys.length > 0) {
    const [row] = await db
      .select()
      .from(auditsTable)
      .where(
        and(
          scopeWhere,
          notArchived,
          sql`lower(trim(${auditsTable.asin})) IN (${sql.join(asinKeys.map((a) => sql`${a}`), sql`, `)})`,
          dedupeOriginWhere(origin),
        ),
      )
      .orderBy(desc(auditsTable.updatedAt))
      .limit(1);
    if (row && originMatchesScope(row.projectOrigin, origin)) return row;
  }

  const rows = await db
    .select()
    .from(auditsTable)
    .where(
      and(
        scopeWhere,
        notArchived,
        dedupeOriginWhere(origin),
      ),
    )
    .orderBy(desc(auditsTable.updatedAt))
    .limit(120);

  for (const row of rows) {
    if (!originMatchesScope(row.projectOrigin, origin)) continue;
    const rowKeys = listingIdentityKeys(
      coalesceListingAsin(row.asin, readSourceUrlFromAudit(row)) ?? row.asin,
      readSourceUrlFromAudit(row),
    );
    if (requestKeys.some((k) => rowKeys.includes(k))) return row;
  }

  return null;
}

export type ListingAuditUpsertFields = {
  projectName?: string | null;
  productName: string;
  productDescription?: string | null;
  asin?: string | null;
  brandName?: string | null;
  category?: string | null;
  title: string;
  bulletPoints: string[];
  imageUrls: string[];
  targetKeywords: string[];
};

export async function applyListingFieldsToAudit(
  auditId: number,
  fields: ListingAuditUpsertFields,
  originPatch?: { projectOrigin: string | null; importMarketplace: string | null },
): Promise<(typeof auditsTable.$inferSelect) | null> {
  const stableAsin =
    coalesceListingAsin(fields.asin, null) ?? (fields.asin?.trim() || null);
  const [updated] = await db
    .update(auditsTable)
    .set({
      projectName: fields.projectName ?? fields.productName,
      productName: fields.productName,
      productDescription: fields.productDescription?.trim() || null,
      asin: stableAsin,
      brandName: fields.brandName?.trim() || null,
      category: fields.category?.trim() || null,
      title: fields.title,
      bulletPoints: fields.bulletPoints,
      imageUrls: fields.imageUrls,
      targetKeywords: fields.targetKeywords,
      ...(originPatch?.projectOrigin
        ? {
            projectOrigin: originPatch.projectOrigin,
            importMarketplace: originPatch.importMarketplace,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(auditsTable.id, auditId))
    .returning();
  return updated ?? null;
}
