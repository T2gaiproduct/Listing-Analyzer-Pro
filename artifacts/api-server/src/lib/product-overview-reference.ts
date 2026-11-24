import { and, desc, eq } from "drizzle-orm";
import { auditsTable, db, graphicsProjectsTable, type ImageRecords } from "@workspace/db";
import {
  ensureGraphicsProjectSourcesFromAudit,
  persistProductReferenceImagesToDir,
  resolvePrimaryGraphicsProductReference,
} from "./graphics-source-images.js";
import { auditImageDir } from "./image-storage.js";
import path from "node:path";

/** Same sources as Product Explorer overview: audit listing images, scrape records, graphics uploads. */
export async function collectAuditOverviewImageUrls(
  auditId: number,
  extras?: string[] | null,
  graphicsProjectId?: number | null,
): Promise<string[]> {
  const urls: string[] = [];
  const add = (raw?: string | null) => {
    const t = raw?.trim();
    if (t && !urls.includes(t)) urls.push(t);
  };

  for (const u of extras ?? []) add(u);

  const [audit] = await db
    .select({
      imageUrls: auditsTable.imageUrls,
      imageRecords: auditsTable.imageRecords,
    })
    .from(auditsTable)
    .where(eq(auditsTable.id, auditId))
    .limit(1);

  for (const u of audit?.imageUrls ?? []) add(u);
  const records = (audit?.imageRecords ?? []) as ImageRecords | null;
  for (const rec of records ?? []) {
    add(rec.currentUrl);
  }

  if (graphicsProjectId != null && graphicsProjectId > 0) {
    const [gp] = await db
      .select({ sourceImageUrls: graphicsProjectsTable.sourceImageUrls })
      .from(graphicsProjectsTable)
      .where(eq(graphicsProjectsTable.id, graphicsProjectId))
      .limit(1);
    for (const u of gp?.sourceImageUrls ?? []) add(u);
  } else {
    const [gp] = await db
      .select({ sourceImageUrls: graphicsProjectsTable.sourceImageUrls })
      .from(graphicsProjectsTable)
      .where(
        and(eq(graphicsProjectsTable.auditId, auditId), eq(graphicsProjectsTable.isDeleted, 0)),
      )
      .orderBy(desc(graphicsProjectsTable.updatedAt))
      .limit(1);
    for (const u of gp?.sourceImageUrls ?? []) add(u);
  }

  return urls;
}

export async function findGraphicsProjectIdForAudit(auditId: number): Promise<number | null> {
  const [gp] = await db
    .select({ id: graphicsProjectsTable.id })
    .from(graphicsProjectsTable)
    .where(and(eq(graphicsProjectsTable.auditId, auditId), eq(graphicsProjectsTable.isDeleted, 0)))
    .orderBy(desc(graphicsProjectsTable.updatedAt))
    .limit(1);
  return gp?.id ?? null;
}

export function auditProductReferenceDir(auditId: number): string {
  return path.join(auditImageDir(auditId), "product_ref");
}

/**
 * Resolve a local product file for A+ / graphics using overview-equivalent URLs.
 * When a graphics project exists, sources are persisted under that project first.
 */
export async function resolvePrimaryAuditProductReference(
  auditId: number,
  imageUrls: string[] | null | undefined,
  options?: {
    graphicsProjectId?: number | null;
    extraPaths?: string[];
  },
): Promise<string | null> {
  const graphicsProjectId =
    options?.graphicsProjectId ?? (await findGraphicsProjectIdForAudit(auditId));

  const overview = await collectAuditOverviewImageUrls(auditId, imageUrls, graphicsProjectId);

  if (graphicsProjectId != null && graphicsProjectId > 0) {
    const hydrated = await ensureGraphicsProjectSourcesFromAudit(
      graphicsProjectId,
      auditId,
      overview,
    );
    const list = hydrated?.length ? hydrated : overview;
    return resolvePrimaryGraphicsProductReference(graphicsProjectId, list, {
      auditId,
      extraPaths: options?.extraPaths,
    });
  }

  const refDir = auditProductReferenceDir(auditId);
  const saved = await persistProductReferenceImagesToDir(overview, refDir, { auditId });
  const list = saved.length > 0 ? saved : overview;
  return resolvePrimaryGraphicsProductReference(0, list, {
    auditId,
    extraPaths: options?.extraPaths,
    extraSourceDirs: [refDir],
  });
}