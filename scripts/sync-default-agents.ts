/**
 * Sync default SellerLens agent templates to every workspace.
 * Run after schema sync on production (or locally).
 *
 *   DATABASE_URL="postgresql://..." pnpm run db:sync-default-agents
 */
import { syncAllWorkspaceDefaultAgents } from "../artifacts/api-server/src/lib/default-agent-templates.js";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required.");
  }

  await syncAllWorkspaceDefaultAgents();
  console.log("Default SellerLens agents synced to all workspaces.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
