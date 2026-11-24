import assert from "node:assert/strict";

function parseGraphicsImageApiPath(raw: string) {
  const match = raw.trim().match(/\/api\/images\/graphics\/(\d+)\/([^/?#]+)/i);
  if (!match) return null;
  return { projectId: parseInt(match[1], 10), filename: match[2] };
}

function parseAuditPath(raw: string) {
  if (raw.includes("/api/images/graphics/")) return null;
  const match = raw.match(/\/api\/images\/(\d+)\/([^/?#]+)/);
  if (!match) return null;
  return { auditId: parseInt(match[1], 10) };
}

assert.equal(parseGraphicsImageApiPath("/api/images/graphics/9/source_0.jpg")?.projectId, 9);
assert.equal(parseAuditPath("/api/images/graphics/9/source_0.jpg"), null);
assert.equal(parseAuditPath("/api/images/42/listing_0.jpg")?.auditId, 42);
console.log("graphics-source-images.test.ts: ok");