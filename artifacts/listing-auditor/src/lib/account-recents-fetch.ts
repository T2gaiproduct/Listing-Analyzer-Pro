import { getRecents } from "@workspace/api-client-react";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Unified recents for billing-owner account overview (all workspaces). */
export async function fetchAccountOverviewRecents(limit = 200) {
  return fetchJson<{ items: unknown[] }>(
    `${basePath}/api/recents?limit=${limit}&scope=account`,
    { skipWorkspaceHeader: true },
  );
}

/** Workspace-scoped recents (default). */
export async function fetchWorkspaceRecents(limit = 200) {
  return getRecents({ limit });
}
