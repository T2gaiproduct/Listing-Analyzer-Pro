import sharp from "sharp";

/** Amazon A+ standard module width (SellerLens export). */
export const APLUS_MODULE_WIDTH = 970;
export const APLUS_MODULE_HEIGHT = 300;

const APLUS_SAFE_MARGIN_PROMPT =
  "Keep all text and product edges inside a safe area with at least 10% margin on every side; nothing clipped at the frame edge.";

const APLUS_EDGE_TO_EDGE_PROMPT =
  "Compose edge-to-edge across the full ultra-wide strip — no empty side margins, no pillarboxing. Fill the entire banner width with design, product, typography, and graphics like premium Amazon A+ Enhanced Brand Content.";

/** Re-export for module prompts (generation + resize pipeline). */
export { APLUS_SAFE_MARGIN_PROMPT, APLUS_EDGE_TO_EDGE_PROMPT };

/**
 * Fit generated art into Amazon's 970×300 module using center crop (cover) so the banner
 * fills the frame. Letterbox (`inside`) left ~46% of the width empty for 16:10 generations.
 */
export async function resizeAplusModuleBuffer(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(APLUS_MODULE_WIDTH, APLUS_MODULE_HEIGHT, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toBuffer();
}
