import { createNotification } from "./notifications.js";
import { fetchClerkUserEmailAndName } from "./clerk-user.js";

/** In-app + email (per user notification preferences) when a team member creates a workspace. */
export async function notifyMemberCreatedWorkspace(opts: {
  accountOwnerId: string;
  createdByUserId: string;
  workspaceId: number;
  workspaceName: string;
}): Promise<void> {
  if (opts.accountOwnerId === opts.createdByUserId) return;

  const creator = await fetchClerkUserEmailAndName(opts.createdByUserId);
  const creatorLabel = creator?.name?.trim() || creator?.email?.trim() || "A team member";
  const workspaceLink = `/workspaces/${opts.workspaceId}`;

  const ownerTitle = "Team member created a workspace";
  const ownerMessage =
    `${creatorLabel} created workspace "${opts.workspaceName}". Fund the workspace credit pool in Workspaces so members can work in this client space.`;

  void createNotification({
    userId: opts.accountOwnerId,
    type: "workspace_created",
    title: ownerTitle,
    message: ownerMessage,
    link: workspaceLink,
  });

  const memberTitle = "Workspace created — credits needed";
  const memberMessage =
    `You created workspace "${opts.workspaceName}". Your account owner must assign workspace pool credits before you can run audits and projects there.`;

  void createNotification({
    userId: opts.createdByUserId,
    type: "workspace_created",
    title: memberTitle,
    message: memberMessage,
    link: workspaceLink,
  });
}
