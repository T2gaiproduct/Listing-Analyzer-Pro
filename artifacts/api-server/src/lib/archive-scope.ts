import type { Request } from "express";
import { eq, type SQL } from "drizzle-orm";
import { resolveTeamContext } from "../middlewares/team-auth";
import { resolveWorkspaceContext, WORKSPACE_HEADER } from "./workspace-context";

export type ArchiveListScope =
  | { mode: "account" }
  | { mode: "workspace"; workspaceId: number }
  | { mode: "denied" };

/** Resolve which archived items the caller may list or mutate. */
export async function resolveArchiveListScope(
  userId: string,
  ownerId: string,
  req: Request,
): Promise<ArchiveListScope> {
  const team = await resolveTeamContext(userId);
  const billingOwner = userId === ownerId && !team.isTeamMember;
  const accountScope = req.query.scope === "account";
  const headerVal = req.get(WORKSPACE_HEADER) ?? req.get("X-Workspace-Id");
  const queryVal = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;

  if (billingOwner && accountScope) {
    return { mode: "account" };
  }

  const ctx = await resolveWorkspaceContext(userId, headerVal ?? queryVal);
  if (!ctx) {
    return { mode: "denied" };
  }

  return { mode: "workspace", workspaceId: ctx.workspaceId };
}

export function archiveItemWorkspaceClause(
  workspaceIdColumn: { workspaceId: unknown },
  scope: ArchiveListScope,
): SQL | undefined {
  if (scope.mode !== "workspace") return undefined;
  return eq(workspaceIdColumn.workspaceId as never, scope.workspaceId);
}
