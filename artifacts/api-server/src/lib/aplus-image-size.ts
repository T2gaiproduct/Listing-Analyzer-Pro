import sharp from "sharp";

/** Amazon A+ standard module width (SellerLens export). */
export const APLUS_MODULE_WIDTH = 970;
export const APLUS_MODULE_HEIGHT = 300;

const APLUS_SAFE_MARGIN_PROMPT =
  "Keep all text and product edges inside a safe area with at least 10% margin on every side; nothing clipped at the frame edge.";

/** Re-export for module prompts (generation + resize pipeline). */
export { APLUS_SAFE_MARGIN_PROMPT };

/**
 * Fit generated art into Amazon's 970×300 module without cropping (letterbox if needed).
 * Previously used `cover`, which cut off ~45% of 16:9 generations.
 */
export async function resizeAplusModuleBuffer(buffer: Buffer): Promise<Buffer> {
  const fitted = await sharp(buffer)
    .resize(APLUS_MODULE_WIDTH, APLUS_MODULE_HEIGHT, { fit: "inside" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: APLUS_MODULE_WIDTH,
      height: APLUS_MODULE_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: fitted, gravity: "centre" }])
    .png()
    .toBuffer();
}
