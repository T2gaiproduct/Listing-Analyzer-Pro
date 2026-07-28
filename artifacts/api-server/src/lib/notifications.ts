import { db, notificationsTable } from "@workspace/db";
import type { Notification } from "@workspace/db";
import { fetchClerkUserEmailAndName } from "./clerk-user.js";
import { notificationEmailTemplate } from "./email-templates.js";
import { isEmailNotificationsEnabled, sendEmail } from "./email.js";
import { isNotificationDeliveryEnabled } from "./notification-preferences.js";
import { wsSend } from "./ws";

export type NotificationType =
  | "project_renamed"
  | "project_archived"
  | "project_deleted"
  | "project_restored"
  | "project_pinned"
  | "project_unpinned"
  | "audit_completed"
  | "competitor_added"
  | "credits_low"
  | "credit_low"
  | "credit_depleted"
  | "subscription_expired"
  | "subscription_renewed"
  | "payment_received"
  | "team_invite"
  | "team_invite_accepted"
  | "support_ticket_new"
  | "admin_role_invite"
  | "admin_role_assigned"
  | "admin_role_updated"
  | "form_submission_new"
  | "system"
  | "welcome";

function getAppBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://listingauditor.com").replace(/\/$/, "");
}

async function sendNotificationEmail(params: {
  userId: string;
  title: string;
  message: string;
  link?: string;
}): Promise<void> {
  if (!(await isEmailNotificationsEnabled())) return;

  const profile = await fetchClerkUserEmailAndName(params.userId);
  if (!profile?.email) return;

  const base = getAppBaseUrl();
  const actionUrl = params.link
    ? (params.link.startsWith("http") ? params.link : `${base}${params.link.startsWith("/") ? params.link : `/${params.link}`}`)
    : `${base}/notifications`;

  const html = notificationEmailTemplate({
    recipientName: profile.name,
    title: params.title,
    message: params.message,
    actionUrl,
  });

  await sendEmail({
    to: profile.email,
    subject: params.title,
    html,
  });
}

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  skipEmail?: boolean;
}): Promise<Notification | null> {
  if (!(await isNotificationDeliveryEnabled(params.userId, params.type))) {
    return null;
  }

  const [row] = await db
    .insert(notificationsTable)
    .values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
      read: false,
      sentAt: new Date(),
    })
    .returning();

  wsSend(params.userId, "notification", {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    sentAt: row.sentAt,
  });

  if (!params.skipEmail) {
    void sendNotificationEmail({
      userId: params.userId,
      title: params.title,
      message: params.message,
      link: params.link,
    });
  }

  return row;
}

export async function createBulkNotifications(
  userId: string,
  notifications: Array<{
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }>,
  options?: { skipEmail?: boolean },
): Promise<Notification[]> {
  if (notifications.length === 0) return [];

  const enabled = await Promise.all(
    notifications.map(async (n) => ({
      notification: n,
      enabled: await isNotificationDeliveryEnabled(userId, n.type),
    })),
  );
  const toDeliver = enabled.filter((e) => e.enabled).map((e) => e.notification);
  if (toDeliver.length === 0) return [];

  const rows = await db
    .insert(notificationsTable)
    .values(
      toDeliver.map((n) => ({
        userId,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link ?? null,
        read: false,
        sentAt: new Date(),
      })),
    )
    .returning();

  if (!options?.skipEmail) {
    for (const n of toDeliver) {
      void sendNotificationEmail({
        userId,
        title: n.title,
        message: n.message,
        link: n.link,
      });
    }
  }

  return rows;
}
