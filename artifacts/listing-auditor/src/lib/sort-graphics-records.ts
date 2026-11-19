/** Sort product graphics for display: most recently generated/updated first. */
export type GraphicsRecordSortable = {
  id: string;
  index?: number;
  versions?: Array<{ generatedAt?: string }>;
};

export function graphicsRecordLatestAt(record: GraphicsRecordSortable): number {
  const versions = record.versions ?? [];
  const last = versions.length > 0 ? versions[versions.length - 1]?.generatedAt : undefined;
  const parsed = last ? Date.parse(last) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortGraphicsRecordsNewestFirst<T extends GraphicsRecordSortable>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    const at = graphicsRecordLatestAt(a);
    const bt = graphicsRecordLatestAt(b);
    if (bt !== at) return bt - at;
    const aIdx = a.index ?? 0;
    const bIdx = b.index ?? 0;
    if (bIdx !== aIdx) return bIdx - aIdx;
    return b.id.localeCompare(a.id);
  });
}