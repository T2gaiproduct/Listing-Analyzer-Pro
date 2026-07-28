import { eq } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";
import { getEnvSuperAdminUserIds } from "./admin-auth.js";
import { createNotification, type NotificationType } from "./notifications.js";

/** All user IDs that should receive admin alert notifications. */
export async function getAdminNotificationRecipientUserIds(): Promise<string[]> {
  const recipientIds = new Set<string>();

  const admins = await db
    .select({ userId: adminUsersTable.userId })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.isDeleted, 0));

  for (const { userId } of admins) {
    recipientIds.add(userId);
  }

  for (const userId of getEnvSuperAdminUserIds()) {
    recipientIds.add(userId);
  }

  return [...recipientIds];
}

/** Deliver an in-app / email notification to every active admin (respects each admin's prefs). */
export async function notifyAdminUsers(params: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  skipEmail?: boolean;
}): Promise<number> {
  const recipientIds = await getAdminNotificationRecipientUserIds();

  let delivered = 0;
  for (const userId of recipientIds) {
    const row = await createNotification({
      userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      skipEmail: params.skipEmail,
    });
    if (row) delivered += 1;
  }
  return delivered;
}
