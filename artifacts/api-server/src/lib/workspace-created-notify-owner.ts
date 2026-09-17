import { notificationEmailTemplate } from "./email-templates.js";
import { isEmailNotificationsEnabled, sendEmail } from "./email.js";
import { createNotification } from "./notifications.js";
import { fetchClerkUserEmailAndName } from "./clerk-user.js";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";

function getAppBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://sellerlens.io").replace(/\/$/, "");
}

async function resolveLoginEmail(userId: string): Promise<string | null> {
  const [profileRow] = await db
    .select({ loginEmail: userProfilesTable.loginEmail })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);
  const fromProfile = profileRow?.loginEmail?.trim();
  if (fromProfile) return fromProfile;
  return (await fetchClerkUserEmailAndName(userId))?.email ?? null;
}

async function sendNotificationEmail(userId: string, title: string, message: string, link: string): Promise<void> {
  const email = await resolveLoginEmail(userId);
  if (!email || !(await isEmailNotificationsEnabled())) return;
  const profile = await fetchClerkUserEmailAndName(userId);
  const html = notificationEmailTemplate({
    recipientName: profile?.name?.trim() || "there",
    title,
    message,
    actionUrl: `${getAppBaseUrl()}${link}`,
  });
  void sendEmail({ to: email, subject: title, html });
}

/** In-app + email when a team member creates a workspace (owner funds pools; member waits for credits). */
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
  void sendNotificationEmail(opts.accountOwnerId, ownerTitle, ownerMessage, workspaceLink);

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
  void sendNotificationEmail(opts.createdByUserId, memberTitle, memberMessage, workspaceLink);
}
