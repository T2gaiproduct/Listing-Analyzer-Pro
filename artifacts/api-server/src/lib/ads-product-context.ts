import { and, desc, eq } from "drizzle-orm";
import { db, auditsTable } from "@workspace/db";
import type { ListingContext } from "./ads-keyword-pipeline.js";

export async function loadListingContextForAsin(opts: {
  workspaceId: number | null | undefined;
  userId: string;
  asin: string;
  auditId?: number | null;
}): Promise<ListingContext> {
  const asin = opts.asin.trim().toUpperCase();
  if (!asin) return {};

  if (opts.auditId) {
    const [audit] = await db
      .select()
      .from(auditsTable)
      .where(and(eq(auditsTable.id, opts.auditId), eq(auditsTable.isDeleted, 0)));
    if (audit) {
      return {
        title: audit.title,
        bullets: audit.bulletPoints ?? [],
        targetKeywords: audit.targetKeywords ?? [],
        generatedKeywords: audit.generatedContent?.keywords ?? [],
      };
    }
  }

  const conditions = [eq(auditsTable.asin, asin), eq(auditsTable.isDeleted, 0)];
  if (opts.workspaceId) {
    conditions.push(eq(auditsTable.workspaceId, opts.workspaceId));
  }

  const [audit] = await db
    .select()
    .from(auditsTable)
    .where(and(...conditions))
    .orderBy(desc(auditsTable.updatedAt))
    .limit(1);

  if (!audit) return {};

  return {
    title: audit.title,
    bullets: audit.bulletPoints ?? [],
    targetKeywords: audit.targetKeywords ?? [],
    generatedKeywords: audit.generatedContent?.keywords ?? [],
  };
}
