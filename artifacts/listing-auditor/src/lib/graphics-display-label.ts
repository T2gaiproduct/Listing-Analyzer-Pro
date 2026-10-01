import type { GraphicsImageTypeOption } from "@/components/graphics-type-customize-ui";
import { GRAPHICS_IMAGE_TYPES } from "@/lib/graphics-image-types";

export type GraphicsImageRecordLabelSource = {
  type?: string;
  imageType?: string;
};

/** User-facing label for a generated graphics record (Hero Shot vs internal lifestyle bucket). */
export function resolveGraphicsRecordLabel(
  record: GraphicsImageRecordLabelSource,
  imageTypes?: GraphicsImageTypeOption[],
): string {
  const catalog = imageTypes?.length ? imageTypes : GRAPHICS_IMAGE_TYPES;
  const slug = record.imageType?.trim();
  if (slug) {
    const match = catalog.find((t) => t.id === slug);
    if (match) return match.label;
    if (slug === "custom") return "Custom";
    return slug;
  }

  const bucket = record.type ?? "lifestyle";
  if (bucket === "feature") return "Infographic";
  if (bucket === "main") return "Main";
  if (bucket === "lifestyle") return "Lifestyle";
  return bucket;
}
