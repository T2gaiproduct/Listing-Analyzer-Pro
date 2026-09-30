/**
 * Daily job: permanently delete archive items past retention and send 7-day warnings.
 * Usage: from repo root with DATABASE_URL set —
 *   pnpm --filter @workspace/api-server run purge-archive
 */
import { purgeExpiredArchiveItems } from "./lib/purge-expired-archive.js";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const result = await purgeExpiredArchiveItems();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
