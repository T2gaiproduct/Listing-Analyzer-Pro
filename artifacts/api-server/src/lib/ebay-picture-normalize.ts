import sharp from "sharp";

const MAX_EDGE_PX = 1600;
const MIN_BYTES = 512;
const MAX_BYTES = 4 * 1024 * 1024;

/** eBay EPS accepts JPEG reliably; normalize PNG/WebP and downscale large assets. */
export async function normalizeImageBufferForEbayUpload(buffer: Buffer): Promise<Buffer> {
  if (buffer.length < MIN_BYTES) {
    throw new Error("Image file is too small to upload to eBay.");
  }

  let pipeline = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width > MAX_EDGE_PX || height > MAX_EDGE_PX) {
    pipeline = pipeline.resize({
      width: MAX_EDGE_PX,
      height: MAX_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let jpeg = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  if (jpeg.length > MAX_BYTES) {
    jpeg = await sharp(jpeg).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  }
  if (jpeg.length < MIN_BYTES) {
    throw new Error("Image could not be converted for eBay upload.");
  }
  return jpeg;
}
