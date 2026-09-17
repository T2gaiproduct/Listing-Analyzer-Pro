import { notificationEmailTemplate } from "./email-templates.js";
import { isEmailNotificationsEnabled, sendEmail } from "./email.js";
import { createNotification } from "./notifications.js";
import { fetchClerkUserEmailAndName } from "./clerk-user.js";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";

function getAppBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://sellerlens.io").replace(/\/$/, "");
}

export async function notifyAccountOwnerWorkspaceCreated(opts: {
  accountOwnerId: string;
  createdByUserId: string;
  workspaceName: string;
  creatorDisplayName: string;
}): Promise<void> {
  if (opts.accountOwnerId === opts.createdByUserId) return;

  const title = "New workspace created";
  const message = `${opts.creatorDisplayName} created workspace "${opts.workspaceName}". Fund the workspace pool from Workspaces when you're ready.`;
  const link = "/workspaces";

  void createNotification({
    userId: opts.accountOwnerId,
    type: "workspace_created",
    title,
    message,
    link,
  });

  const [profileRow] = await db
    .select({ loginEmail: userProfilesTable.loginEmail })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, opts.accountOwnerId))
    .limit(1);
  const ownerEmail = profileRow?.loginEmail?.trim()
    ?? (await fetchClerkUserEmailAndName(opts.accountOwnerId))?.email;
  if (!ownerEmail || !(await isEmailNotificationsEnabled())) return;

  const ownerProfile = await fetchClerkUserEmailAndName(opts.accountOwnerId);
  const html = notificationEmailTemplate({
    recipientName: ownerProfile?.name?.trim() || "there",
    title,
    message,
    actionUrl: `${getAppBaseUrl()}${link}`,
  });
  void sendEmail({ to: ownerEmail, subject: title, html });
}
