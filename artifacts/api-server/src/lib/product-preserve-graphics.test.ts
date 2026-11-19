import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  compositeProductPreserveHero,
  isProductPreserveGraphicsType,
} from "./product-preserve-graphics.js";

async function writeFixturePng(filePath: string): Promise<void> {
  const buf = await sharp({
    create: { width: 400, height: 200, channels: 3, background: { r: 20, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
  fs.writeFileSync(filePath, buf);
}

async function main() {
  assert.equal(isProductPreserveGraphicsType("hero"), true);
  assert.equal(isProductPreserveGraphicsType("lifestyle"), false);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hero-preserve-"));
  const src = path.join(tmp, "product.png");
  await writeFixturePng(src);

  const out = await compositeProductPreserveHero(src, "1024x1024");
  assert.ok(out.length > 1_000);
  const meta = await sharp(out).metadata();
  assert.equal(meta.width, 1024);
  assert.equal(meta.height, 1024);

  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  const corner = data[0]! + data[1]! + data[2]!;
  assert.ok(corner > 750, "corners should be near-white canvas");
  assert.ok(info.width === 1024);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("product-preserve-graphics.test.ts: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});