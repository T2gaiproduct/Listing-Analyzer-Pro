import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { auditsTable, db, type ImageRecord } from "@workspace/db";
import { loadAuditForExport } from "./audit-export-loader.js";
import { materializeAuditImagesForPublish } from "./materialize-audit-images-for-publish.js";
import { resolveAmazonExportImageBaseUrl } from "./resolve-public-base-url.js";
import { getAccountOwnerId } from "./workspace-route-helpers.js";
import {
  buildAuditExportBundle,
  buildBulkExcelBuffer,
  type AuditExportBundle,
} from "./amazon-listing-export.js";

export const BULK_PRODUCTS_EXPORT_MAX = 100;

export interface BulkExportItem {
  auditId: number;
  workspaceId?: number | null;
}

export interface BulkProductsExportResult {
  buffer: Buffer;
  exportedCount: number;
  skipped: Array<{ auditId: number; reason: string }>;
}

async function loadAuditForBulkItem(
  req: Request,
  auditId: number,
  workspaceId?: number | null,
) {
  const ws = workspaceId != null && workspaceId > 0 ? workspaceId : undefined;
  if (ws != null) {
    return loadAuditForExport(req, auditId, { workspaceId: ws });
  }

  let loaded = await loadAuditForExport(req, auditId);
  if (loaded) return loaded;

  const ownerId = getAccountOwnerId(req);
  const [row] = await db
    .select({ workspaceId: auditsTable.workspaceId })
    .from(auditsTable)
    .where(and(
      eq(auditsTable.id, auditId),
      eq(auditsTable.userId, ownerId),
      eq(auditsTable.isDeleted, 0),
    ))
    .limit(1);

  if (row?.workspaceId != null && row.workspaceId > 0) {
    loaded = await loadAuditForExport(req, auditId, { workspaceId: row.workspaceId });
  }
  return loaded;
}

export async function buildBulkProductsExcelExport(
  req: Request,
  items: BulkExportItem[],
  marketplaceId: string = "US",
): Promise<BulkProductsExportResult> {
  const bundles: AuditExportBundle[] = [];
  const skipped: Array<{ auditId: number; reason: string }> = [];
  const publicBaseUrl = resolveAmazonExportImageBaseUrl(req);

  const seen = new Set<number>();
  for (const item of items) {
    const auditId = item.auditId;
    if (!Number.isFinite(auditId) || auditId <= 0) {
      skipped.push({ auditId, reason: "Invalid audit id" });
      continue;
    }
    if (seen.has(auditId)) continue;
    seen.add(auditId);

    const loaded = await loadAuditForBulkItem(req, auditId, item.workspaceId);
    if (!loaded) {
      skipped.push({ auditId, reason: "Listing not found or no access" });
      continue;
    }

    try {
      const audit = await materializeAuditImagesForPublish(loaded.audit);
      const graphicsImageRecords = (loaded.graphicsProject?.imageRecords as ImageRecord[] | null) ?? undefined;
      const graphicsProjectId = loaded.graphicsProject?.id ?? null;
      const bundle = buildAuditExportBundle({
        audit,
        marketplaceId,
        graphicsImageRecords,
        graphicsProjectId,
        publicBaseUrl,
      });
      bundles.push(bundle);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Export failed";
      skipped.push({ auditId, reason });
    }
  }

  if (bundles.length === 0) {
    const detail = skipped[0]?.reason ?? "No exportable listings";
    throw new Error(detail);
  }

  const buffer = await buildBulkExcelBuffer(bundles);
  return { buffer, exportedCount: bundles.length, skipped };
}
