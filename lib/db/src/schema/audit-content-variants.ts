import { pgTable, serial, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { generatedContentSchema } from "./audits.js";
import type { z } from "zod/v4";

export type AuditContentVariantGenerated = z.infer<typeof generatedContentSchema>;

export const auditContentVariantsTable = pgTable(
  "audit_content_variants",
  {
    id: serial("id").primaryKey(),
    auditId: integer("audit_id").notNull(),
    contentMarketplaceId: integer("content_marketplace_id").notNull(),
    generatedContent: jsonb("generated_content").$type<AuditContentVariantGenerated>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    auditMarketplaceUnique: uniqueIndex("audit_content_variants_audit_marketplace_uidx").on(
      table.auditId,
      table.contentMarketplaceId,
    ),
  }),
);
