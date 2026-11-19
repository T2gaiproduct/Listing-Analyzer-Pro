import assert from "node:assert/strict";
import test from "node:test";
import type { GraphicsImageRecord } from "@workspace/db";

import {
  findGraphicsRecordForImageType,
  mergeGraphicsImageRecords,
} from "./graphics-image-records";

function rec(id: string, imageType?: string): GraphicsImageRecord {
  return {
    id,
    type: "lifestyle",
    index: Number(id.split("_")[1] ?? 0),
    imageType,
    style: "custom",
    aspectRatio: "1:1",
    currentUrl: `/api/images/graphics/1/${id}.png`,
    versions: [],
  };
}

test("findGraphicsRecordForImageType returns most recent duplicate", () => {
  const existing = [rec("lifestyle_0", "hero"), rec("lifestyle_1", "hero")];
  assert.equal(findGraphicsRecordForImageType(existing, "hero")?.id, "lifestyle_1");
});

test("mergeGraphicsImageRecords replaces by id and appends new", () => {
  const existing = [rec("lifestyle_0", "hero"), rec("lifestyle_1", "lifestyle")];
  const updated = [
    { ...rec("lifestyle_0", "hero"), currentUrl: "/new-hero.png" },
    rec("lifestyle_2", "callouts"),
  ];
  const merged = mergeGraphicsImageRecords(existing, updated);
  assert.equal(merged.length, 3);
  assert.equal(merged[0]?.currentUrl, "/new-hero.png");
  assert.equal(merged[2]?.id, "lifestyle_2");
});