import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { auditsTable, db } from "@workspace/db";

/** Canonical identity for “same product link / ASIN” within a workspace + origin. */
export function listingCatalogKey(
  asin?: string | null,
  sourceListingUrl?: string | null,
): string | null {
  const trimmedAsin = asin?.trim();
  if (trimmedAsin) return `asin:${trimmedAsin.toLowerCase()}`;

  const urlKey = canonicalListingUrlKey(sourceListingUrl);
  return urlKey ? `url:${urlKey}` : null;
}

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
    return `${url.hostname.toLowerCase()}${path}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

type ListingIdentity = {
  asin?: string | null;
  sourceListingUrl?: string | null;
};

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

  const key = listingCatalogKey(opts.asin, opts.sourceListingUrl);
  if (!key) return null;

  const notArchived = sql`${auditsTable.status} != 'archived'`;

  if (key.startsWith("asin:")) {
    const asinVal = key.slice("asin:".length);
    const [row] = await db
      .select()
      .from(auditsTable)
      .where(
        and(
          scopeWhere,
          notArchived,
          eq(auditsTable.projectOrigin, origin),
          sql`lower(trim(${auditsTable.asin})) = ${asinVal}`,
        ),
      )
      .orderBy(desc(auditsTable.updatedAt))
      .limit(1);
    return row ?? null;
  }

  const rows = await db
    .select()
    .from(auditsTable)
    .where(
      and(
        scopeWhere,
        notArchived,
        eq(auditsTable.projectOrigin, origin),
      ),
    )
    .orderBy(desc(auditsTable.updatedAt))
    .limit(80);

  for (const row of rows) {
    const rowKey = listingCatalogKey(row.asin, readSourceUrlFromAudit(row));
    if (rowKey === key) return row;
  }

  return null;
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
): Promise<(typeof auditsTable.$inferSelect) | null> {
  const [updated] = await db
    .update(auditsTable)
    .set({
      projectName: fields.projectName ?? fields.productName,
      productName: fields.productName,
      productDescription: fields.productDescription?.trim() || null,
      asin: fields.asin?.trim() || null,
      brandName: fields.brandName?.trim() || null,
      category: fields.category?.trim() || null,
      title: fields.title,
      bulletPoints: fields.bulletPoints,
      imageUrls: fields.imageUrls,
      targetKeywords: fields.targetKeywords,
      updatedAt: new Date(),
    })
    .where(eq(auditsTable.id, auditId))
    .returning();
  return updated ?? null;
}
