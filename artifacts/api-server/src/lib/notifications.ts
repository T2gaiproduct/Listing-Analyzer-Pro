import { db, notificationsTable } from "@workspace/db";

export interface NotificationData {
  userId?: string | null;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}

export async function createNotification(data: NotificationData): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: data.userId ?? null,
    type: data.type,
    title: data.title,
    message: data.message,
    link: data.link ?? null,
    read: false,
  });
}

export async function createAdminNotification(data: Omit<NotificationData, "userId">): Promise<void> {
  // Admin notifications are broadcast (userId = null) so all admins see them
  await db.insert(notificationsTable).values({
    userId: null,
    type: data.type,
    title: data.title,
    message: data.message,
    link: data.link ?? null,
    read: false,
  });
}
