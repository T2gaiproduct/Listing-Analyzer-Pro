import { and, eq } from "drizzle-orm";
import {
  auditContentVariantsTable,
  type AuditContentVariantGenerated,
  db,
} from "@workspace/db";

export async function listAuditContentVariants(auditId: number) {
  return db
    .select({
      contentMarketplaceId: auditContentVariantsTable.contentMarketplaceId,
      generatedContent: auditContentVariantsTable.generatedContent,
      updatedAt: auditContentVariantsTable.updatedAt,
    })
    .from(auditContentVariantsTable)
    .where(eq(auditContentVariantsTable.auditId, auditId));
}

export async function upsertAuditContentVariant(
  auditId: number,
  contentMarketplaceId: number,
  generatedContent: AuditContentVariantGenerated,
) {
  const now = new Date();
  const existing = await db
    .select({ id: auditContentVariantsTable.id })
    .from(auditContentVariantsTable)
    .where(
      and(
        eq(auditContentVariantsTable.auditId, auditId),
        eq(auditContentVariantsTable.contentMarketplaceId, contentMarketplaceId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(auditContentVariantsTable)
      .set({ generatedContent, updatedAt: now })
      .where(eq(auditContentVariantsTable.id, existing[0].id));
    return;
  }

  await db.insert(auditContentVariantsTable).values({
    auditId,
    contentMarketplaceId,
    generatedContent,
    updatedAt: now,
  });
}
