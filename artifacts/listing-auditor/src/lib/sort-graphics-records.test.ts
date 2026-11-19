import assert from "node:assert/strict";
import test from "node:test";

import { sortGraphicsRecordsNewestFirst } from "./sort-graphics-records";

test("sortGraphicsRecordsNewestFirst orders by latest version time desc", () => {
  const sorted = sortGraphicsRecordsNewestFirst([
    { id: "a", index: 0, versions: [{ generatedAt: "2026-01-01T00:00:00.000Z" }] },
    { id: "b", index: 1, versions: [{ generatedAt: "2026-02-01T00:00:00.000Z" }] },
  ]);
  assert.deepEqual(sorted.map((r) => r.id), ["b", "a"]);
});