import sharp from "sharp";

/** Amazon A+ standard module width (SellerLens export). */
export const APLUS_MODULE_WIDTH = 970;
export const APLUS_MODULE_HEIGHT = 300;

const APLUS_SAFE_MARGIN_PROMPT =
  "Keep all text, product packaging, and logos fully visible with safe margins; nothing cropped or clipped at any edge.";

const APLUS_EDGE_TO_EDGE_PROMPT =
  "Compose as one ultra-wide shallow horizontal band (970x300 proportions). Spread product, headline, icons, and callouts across the width in a single row. Keep the full product and all text legible—never cut off the top or bottom of the product or typography.";

/** Re-export for module prompts (generation + resize pipeline). */
export { APLUS_SAFE_MARGIN_PROMPT, APLUS_EDGE_TO_EDGE_PROMPT };

/**
 * Fit generated art into 970×300 without cropping (contain). Uses a soft blurred
 * background fill on the sides so the module still feels full-width on Amazon.
 */
export async function resizeAplusModuleBuffer(buffer: Buffer): Promise<Buffer> {
  const foreground = await sharp(buffer)
    .resize(APLUS_MODULE_WIDTH, APLUS_MODULE_HEIGHT, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  const background = await sharp(buffer)
    .resize(APLUS_MODULE_WIDTH, APLUS_MODULE_HEIGHT, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .blur(24)
    .modulate({ brightness: 0.92, saturation: 1.05 })
    .png()
    .toBuffer();

  return sharp(background)
    .composite([{ input: foreground, gravity: "centre" }])
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toBuffer();
}
