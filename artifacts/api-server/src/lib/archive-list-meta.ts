import {
  archivePurgeDeadline,
  archiveRetentionDays,
  archiveRetentionPolicySummary,
  daysUntilArchivePurge,
} from "./archive-retention.js";

export function withArchiveRetentionMeta<
  T extends { deletedAt?: Date | string | null; updatedAt?: Date | string | null },
>(item: T) {
  const purgeAt = archivePurgeDeadline(item.deletedAt, item.updatedAt);
  const daysUntilPurge = daysUntilArchivePurge(item.deletedAt, item.updatedAt);
  return {
    ...item,
    retentionDays: archiveRetentionDays(),
    purgeAt: purgeAt?.toISOString() ?? null,
    daysUntilPurge,
  };
}

export function archiveListPolicy() {
  return {
    retentionDays: archiveRetentionDays(),
    policySummary: archiveRetentionPolicySummary(),
  };
}
