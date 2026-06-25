import { db, notificationsTable } from "@workspace/db";
import type { Notification } from "@workspace/db";

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
  | "subscription_expired"
  | "subscription_renewed"
  | "payment_received"
  | "team_invite"
  | "team_invite_accepted"
  | "system"
  | "welcome";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}): Promise<Notification> {
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
  return row;
}

export async function createBulkNotifications(
  userId: string,
  notifications: Array<{
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }>
): Promise<Notification[]> {
  if (notifications.length === 0) return [];
  const rows = await db
    .insert(notificationsTable)
    .values(
      notifications.map((n) => ({
        userId,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link ?? null,
        read: false,
        sentAt: new Date(),
      }))
    )
    .returning();
  return rows;
}
