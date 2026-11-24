import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  compositeProductOnScene,
  compositeProductPreserveHero,
  isOpenAiSafetyRejection,
  isProductPreserveGraphicsType,
  resolveProductPreserveLayout,
} from "./product-preserve-graphics.js";

async function writeFixturePng(filePath: string, color: { r: number; g: number; b: number }): Promise<void> {
  const buf = await sharp({
    create: { width: 400, height: 200, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  fs.writeFileSync(filePath, buf);
}

async function main() {
  assert.equal(isProductPreserveGraphicsType("hero"), true);
  assert.equal(isProductPreserveGraphicsType("lifestyle"), true);
  assert.equal(resolveProductPreserveLayout("hero", "1024x1024"), "studio");
  assert.equal(resolveProductPreserveLayout("hero", "1792x1024"), "banner_west");
  assert.equal(isOpenAiSafetyRejection(new Error("400 safety_violations=[sexual]")), true);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hero-preserve-"));
  const src = path.join(tmp, "product.png");
  await writeFixturePng(src, { r: 20, g: 120, b: 200 });

  const heroOut = await compositeProductPreserveHero(src, "1024x1024");
  assert.ok(heroOut.length > 1_000);
  const meta = await sharp(heroOut).metadata();
  assert.equal(meta.width, 1024);
  assert.equal(meta.height, 1024);

  const scenePath = path.join(tmp, "scene.jpg");
  const sceneBuf = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 240, g: 230, b: 220 } },
  })
    .jpeg()
    .toBuffer();
  fs.writeFileSync(scenePath, sceneBuf);

  const lifestyleOut = await compositeProductOnScene(
    src,
    "1024x1024",
    "lifestyle_scene",
    sceneBuf,
  );
  assert.ok(lifestyleOut.length > 1_000);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("product-preserve-graphics.test.ts: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});