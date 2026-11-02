import { eq } from "drizzle-orm";
import { auditsTable, db, normalizeReferenceResearchData } from "@workspace/db";
import type { GeneratedContent } from "@workspace/db";
import { buildSourceListingSnapshot } from "./source-listing-content.js";

export type ImportAttributeRow = { attribute: string; value: string };

export function readImportAttributesFromBody(body: unknown): ImportAttributeRow[] {
  if (!body || typeof body !== "object") return [];
  const raw = (body as { importAttributes?: unknown }).importAttributes;
  if (!Array.isArray(raw)) return [];
  const rows: ImportAttributeRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const attribute = typeof (item as { attribute?: unknown }).attribute === "string"
      ? (item as { attribute: string }).attribute.trim()
      : "";
    const value = typeof (item as { value?: unknown }).value === "string"
      ? (item as { value: string }).value.trim()
      : "";
    if (attribute && value) rows.push({ attribute, value });
  }
  return rows.slice(0, 40);
}

export async function persistAmazonImportExtras(
  auditId: number,
  opts: {
    importAttributes?: ImportAttributeRow[];
    sourceUrl?: string | null;
    marketplaceNotes?: string | null;
  },
): Promise<void> {
  const attributes = opts.importAttributes?.filter((r) => r.attribute && r.value) ?? [];
  const sourceUrl = opts.sourceUrl?.trim() || "";
  const [audit] = await db.select().from(auditsTable).where(eq(auditsTable.id, auditId)).limit(1);
  if (!audit) return;

  const updates: {
    referenceResearch?: ReturnType<typeof normalizeReferenceResearchData>;
    sourceListingContent?: GeneratedContent;
  } = {};

  if (attributes.length > 0 || sourceUrl) {
    const referenceResearch = normalizeReferenceResearchData({
      slots: sourceUrl
        ? [{ url: sourceUrl, notes: opts.marketplaceNotes?.trim() || "amazon" }]
        : (audit.referenceResearch?.slots ?? []),
      productDetails: attributes.length > 0
        ? attributes
        : audit.referenceResearch?.productDetails,
    });
    updates.referenceResearch = referenceResearch;
  }

  const snapshot = buildSourceListingSnapshot(audit);
  if (attributes.length > 0) {
    snapshot.attributes = attributes;
  }
  updates.sourceListingContent = snapshot;

  await db
    .update(auditsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(auditsTable.id, auditId));
}
