/** Days archived items remain recoverable before automatic permanent deletion. */
export const ARCHIVE_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function archiveRetentionMs(): number {
  const fromEnv = Number(process.env.ARCHIVE_RETENTION_DAYS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv) * DAY_MS;
  }
  return ARCHIVE_RETENTION_DAYS * DAY_MS;
}

/** When the item entered Archive (soft delete or archived status). */
export function archiveRetentionAnchor(
  deletedAt: Date | string | null | undefined,
  updatedAt: Date | string | null | undefined,
): Date | null {
  const raw = deletedAt ?? updatedAt;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function archivePurgeDeadline(
  deletedAt: Date | string | null | undefined,
  updatedAt: Date | string | null | undefined,
): Date | null {
  const anchor = archiveRetentionAnchor(deletedAt, updatedAt);
  if (!anchor) return null;
  return new Date(anchor.getTime() + archiveRetentionMs());
}

export function isArchiveRetentionExpired(
  deletedAt: Date | string | null | undefined,
  updatedAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  const deadline = archivePurgeDeadline(deletedAt, updatedAt);
  if (!deadline) return false;
  return deadline.getTime() <= now.getTime();
}

export function daysUntilArchivePurge(
  deletedAt: Date | string | null | undefined,
  updatedAt: Date | string | null | undefined,
  now = new Date(),
): number | null {
  const deadline = archivePurgeDeadline(deletedAt, updatedAt);
  if (!deadline) return null;
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / DAY_MS);
}

export function archiveRetentionDays(): number {
  return Math.round(archiveRetentionMs() / DAY_MS);
}

export function archiveRetentionPolicySummary(): string {
  const days = archiveRetentionDays();
  return `Items in Archive are permanently deleted after ${days} days if not restored.`;
}
