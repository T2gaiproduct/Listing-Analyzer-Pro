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

/** Per-type increases from this assignment (ignores decreases). */
export function creditAssignmentIncreaseDelta(
  previous: CreditTotals,
  assigned: CreditTotals,
): CreditTotals {
  return {
    auditCredits: Math.max(0, assigned.auditCredits - previous.auditCredits),
    aiCredits: Math.max(0, assigned.aiCredits - previous.aiCredits),
    imageCredits: Math.max(0, assigned.imageCredits - previous.imageCredits),
  };
}

function creditPhrase(amount: number, label: string): string {
  const n = Number(amount) || 0;
  if (n <= 0) return "";
  const unit = n === 1 ? "credit" : "credits";
  return `${n} ${unit} for ${label}`;
}

/** Build in-app and email copy from amounts assigned in this save only. */
export function formatCreditAssignmentMessage(
  workspaceName: string,
  increase: CreditTotals,
): { title: string; message: string } {
  const parts = [
    creditPhrase(increase.auditCredits, "audits"),
    creditPhrase(increase.aiCredits, "text content"),
    creditPhrase(increase.imageCredits, "images"),
  ].filter(Boolean);

  const summary = parts.length > 0 ? parts.join(" and ") : "0 credits";
  const verb = parts.length === 1 && increase.auditCredits + increase.aiCredits + increase.imageCredits === 1
    ? "has"
    : "have";

  return {
    title: "Credits assigned",
    message: `${summary} ${verb} been assigned in ${workspaceName}.`,
  };
}

function creditTotalsIncreased(previous: CreditTotals, assigned: CreditTotals): boolean {
  const delta = creditAssignmentIncreaseDelta(previous, assigned);
  return delta.auditCredits > 0 || delta.aiCredits > 0 || delta.imageCredits > 0;
}

export async function notifyWorkspaceMemberCreditsAssigned(opts: {
  workspaceId: number;
  workspaceMemberId: number;
  previousCredits: CreditTotals;
  assignedCredits: CreditTotals;
}): Promise<void> {
  if (!creditTotalsIncreased(opts.previousCredits, opts.assignedCredits)) return;

  const increase = creditAssignmentIncreaseDelta(opts.previousCredits, opts.assignedCredits);

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

  const { title, message } = formatCreditAssignmentMessage(row.workspaceName, increase);
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
