import sharp from "sharp";

/** Fallback when a module has no Amazon dimension metadata (legacy). */
export const APLUS_MODULE_WIDTH = 970;
export const APLUS_MODULE_HEIGHT = 300;

const APLUS_SAFE_MARGIN_PROMPT =
  "Keep all text, product packaging, and logos fully visible with safe margins; nothing cropped or clipped at any edge.";

const APLUS_EDGE_TO_EDGE_PROMPT =
  "Compose as one ultra-wide shallow horizontal band (970x300 proportions). Spread product, headline, icons, and callouts across the width in a single row. Keep the full product and all text legible—never cut off the top or bottom of the product or typography.";

/** Re-export for module prompts (generation + resize pipeline). */
export { APLUS_SAFE_MARGIN_PROMPT, APLUS_EDGE_TO_EDGE_PROMPT };

export type AplusExportSize = { width: number; height: number };

export function resolveAplusExportSize(width?: number | null, height?: number | null): AplusExportSize {
  const w = typeof width === "number" && width > 0 ? Math.round(width) : APLUS_MODULE_WIDTH;
  const h = typeof height === "number" && height > 0 ? Math.round(height) : APLUS_MODULE_HEIGHT;
  return { width: w, height: h };
}

/** Pick an OpenAI image size closest to the Amazon module aspect ratio. */
export function openAiSizeForAplusDims(width: number, height: number): "1792x1024" | "1024x1024" | "1024x1792" {
  const ratio = width / Math.max(height, 1);
  if (ratio >= 1.35) return "1792x1024";
  if (ratio <= 0.75) return "1024x1792";
  return "1024x1024";
}

/**
 * Fit generated art into the Amazon module pixel size for this template.
 * Uses cover (center crop) so the real image fills edge-to-edge — no blurred
 * side extensions, letterboxing, or background fills. Preview and export share
 * this same buffer composition.
 */
export async function resizeAplusModuleBuffer(
  buffer: Buffer,
  size?: AplusExportSize | null,
): Promise<Buffer> {
  const { width, height } = resolveAplusExportSize(size?.width, size?.height);
  return sharp(buffer)
    .resize(width, height, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toBuffer();
}
