import { z } from "zod/v4";

/** Shared listing generated-content shapes (used by audits + audit_content_variants). */
export const generatedListingAttributeSchema = z.object({
  attribute: z.string(),
  value: z.string(),
});

export const generatedContentSchema = z.object({
  title: z.string(),
  bulletPoints: z.array(z.string()),
  keywords: z.array(z.string()),
  htmlDescription: z.string(),
  attributes: z.array(generatedListingAttributeSchema).optional(),
});

export type GeneratedContent = z.infer<typeof generatedContentSchema>;