import type { GraphicsImageRecord } from "@workspace/db";

export function findGraphicsRecordForImageType(
  existing: GraphicsImageRecord[],
  imageType: string,
): GraphicsImageRecord | undefined {
  const slug = imageType.trim();
  if (!slug) return undefined;
  const matches = existing.filter((r) => r.imageType?.trim() === slug);
  if (matches.length === 0) return undefined;
  return matches[matches.length - 1];
}

export function mergeGraphicsImageRecords(
  existing: GraphicsImageRecord[],
  generated: GraphicsImageRecord[],
): GraphicsImageRecord[] {
  const updatesById = new Map(generated.map((r) => [r.id, r]));
  const merged = existing.map((r) => updatesById.get(r.id) ?? r);
  const existingIds = new Set(existing.map((r) => r.id));
  for (const rec of generated) {
    if (!existingIds.has(rec.id)) merged.push(rec);
  }
  return merged;
}