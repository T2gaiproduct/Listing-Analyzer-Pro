import { eq } from "drizzle-orm";
import { db, workspaceMembersTable, workspacesTable } from "@workspace/db";
import { fetchClerkUserIdByEmail } from "./clerk-user.js";
import { notificationEmailTemplate } from "./email-templates.js";
import { isEmailNotificationsEnabled, sendEmail } from "./email.js";
import { createNotification } from "./notifications.js";
import type { CreditTotals } from "./workspace-credits.js";

function getAppBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://sellerlens.io").replace(/\/$/, "");
}

function formatCreditAssignmentMessage(
  workspaceName: string,
  credits: CreditTotals,
): { title: string; message: string } {
  const parts: string[] = [];
  if (credits.auditCredits > 0) parts.push(`${credits.auditCredits} audit`);
  if (credits.aiCredits > 0) parts.push(`${credits.aiCredits} text`);
  if (credits.imageCredits > 0) parts.push(`${credits.imageCredits} image`);
  const summary = parts.length > 0 ? parts.join(", ") : "0 credits";
  return {
    title: "Credits assigned",
    message: `You have been assigned ${summary} credit${parts.length === 1 ? "" : "s"} in ${workspaceName}.`,
  };
}

function creditTotalsIncreased(previous: CreditTotals, assigned: CreditTotals): boolean {
  return (
    assigned.auditCredits > previous.auditCredits
    || assigned.aiCredits > previous.aiCredits
    || assigned.imageCredits > previous.imageCredits
  );
}

export async function notifyWorkspaceMemberCreditsAssigned(opts: {
  workspaceId: number;
  workspaceMemberId: number;
  previousCredits: CreditTotals;
  assignedCredits: CreditTotals;
}): Promise<void> {
  if (!creditTotalsIncreased(opts.previousCredits, opts.assignedCredits)) return;

  const [row] = await db
    .select({
      userId: workspaceMembersTable.userId,
      invitedEmail: workspaceMembersTable.invitedEmail,
      invitedName: workspaceMembersTable.invitedName,
      workspaceName: workspacesTable.name,
    })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .where(eq(workspaceMembersTable.id, opts.workspaceMemberId))
    .limit(1);

  if (!row) return;

  const { title, message } = formatCreditAssignmentMessage(row.workspaceName, opts.assignedCredits);
  const link = "/billing";

  let recipientUserId = row.userId;
  if (!recipientUserId && row.invitedEmail) {
    recipientUserId = await fetchClerkUserIdByEmail(row.invitedEmail);
  }

  if (recipientUserId) {
    void createNotification({
      userId: recipientUserId,
      type: "credits_assigned",
      title,
      message,
      link,
    });
    return;
  }

  const email = row.invitedEmail.trim();
  if (!email || !(await isEmailNotificationsEnabled())) return;

  const html = notificationEmailTemplate({
    recipientName: row.invitedName?.trim() || "there",
    title,
    message,
    actionUrl: `${getAppBaseUrl()}${link}`,
  });
  void sendEmail({ to: email, subject: title, html });
}
