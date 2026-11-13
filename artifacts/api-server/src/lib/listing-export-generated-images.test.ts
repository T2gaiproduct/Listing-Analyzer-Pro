import assert from "node:assert/strict";
import type { Audit, ImageRecord } from "@workspace/db";
import {
  collectGeneratedProductImages,
  isGeneratedExportImageUrl,
} from "./listing-export-shared.js";

function testRejectsSourceAndUploadUrls(): void {
  assert.equal(isGeneratedExportImageUrl("https://m.media-amazon.com/images/I/abc.jpg"), false);
  assert.equal(isGeneratedExportImageUrl("/api/images/graphics/3/lifestyle_0_1.jpg"), true);
  assert.equal(isGeneratedExportImageUrl("/api/images/3/source/source_1.jpg"), false);
  assert.equal(isGeneratedExportImageUrl("furryfits_premium_leaf_print_c"), false);
  assert.equal(isGeneratedExportImageUrl("furryfits_premium_leaf_print_dog_bed_02.jpg"), false);
}

function testGraphicsRecordsOnlyWhenPresent(): void {
  const audit = {
    id: 1,
    imageUrls: ["https://m.media-amazon.com/images/I/uploaded.jpg"],
    imageRecords: [
      {
        id: "main_0",
        type: "main",
        index: 0,
        style: "premium",
        aspectRatio: "1:1",
        currentUrl: "https://m.media-amazon.com/images/I/scraped.jpg",
        versions: [],
      },
    ] as ImageRecord[],
  } as Audit;

  const graphics = [
    {
      id: "lifestyle_0",
      type: "lifestyle",
      index: 0,
      style: "premium",
      aspectRatio: "1:1",
      currentUrl: "/api/images/graphics/9/lifestyle_0_abc.jpg",
      versions: [{ url: "/api/images/graphics/9/lifestyle_0_abc.jpg", style: "premium", aspectRatio: "1:1", isEdit: false, generatedAt: "2026-01-01" }],
    },
  ] as ImageRecord[];

  const picked = collectGeneratedProductImages(audit, graphics);
  assert.equal(picked.length, 1);
  assert.ok(picked[0]!.url.includes("/api/images/graphics/"));
  assert.ok(!picked.some((p) => p.url.includes("amazon.com")));

  const placeholders = [
    {
      id: "lifestyle_1",
      type: "lifestyle" as const,
      index: 1,
      style: "premium",
      aspectRatio: "1:1",
      currentUrl: "furryfits_premium_leaf_print_c",
      versions: [],
    },
  ] as ImageRecord[];
  assert.equal(collectGeneratedProductImages(audit, placeholders).length, 0);
}

testRejectsSourceAndUploadUrls();
testGraphicsRecordsOnlyWhenPresent();
console.log("listing-export-generated-images: generated-only URLs");
