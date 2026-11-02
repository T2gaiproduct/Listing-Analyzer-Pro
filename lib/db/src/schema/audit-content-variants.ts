import { pgTable, serial, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { generatedContentSchema } from "./audits.js";

export const listingContentFieldKeySchema = z.enum([
  "title",
  "bulletPoints",
  "keywords",
  "htmlDescription",
  "attributes",
]);
export type ListingContentFieldKey = z.infer<typeof listingContentFieldKeySchema>;

export const listingContentFieldSourceSchema = z.enum(["current", "ai"]);
export type ListingContentFieldSource = z.infer<typeof listingContentFieldSourceSchema>;

export const listingContentFieldSourcesSchema = z.partialRecord(
  listingContentFieldKeySchema,
  listingContentFieldSourceSchema,
);

export const auditContentVariantGeneratedSchema = generatedContentSchema.extend({
  /** Which side is kept per field after user review (defaults to ai when missing). */
  fieldSources: listingContentFieldSourcesSchema.optional(),
  /** Raw AI output from the last Generate for this marketplace (for compare + toggles). */
  aiSnapshot: generatedContentSchema.optional(),
});

export type AuditContentVariantGenerated = z.infer<typeof auditContentVariantGeneratedSchema>;

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
