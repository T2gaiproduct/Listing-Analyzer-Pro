import sharp from "sharp";

/** Amazon A+ standard module width (SellerLens export). */
export const APLUS_MODULE_WIDTH = 970;
export const APLUS_MODULE_HEIGHT = 300;

/**
 * Fit generated art into Amazon's 970×300 module without cropping (letterbox if needed).
 * Previously used `cover`, which cut off ~45% of 16:9 generations.
 */
export async function resizeAplusModuleBuffer(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(APLUS_MODULE_WIDTH, APLUS_MODULE_HEIGHT, {
      fit: "contain",
      position: "centre",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
}
