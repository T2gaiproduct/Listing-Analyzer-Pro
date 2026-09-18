import sharp from "sharp";

/** Amazon A+ standard module width (SellerLens export). */
export const APLUS_MODULE_WIDTH = 970;
export const APLUS_MODULE_HEIGHT = 300;

/** Resize any generated A+ module image to the standard banner dimensions. */
export async function resizeAplusModuleBuffer(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(APLUS_MODULE_WIDTH, APLUS_MODULE_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
}
