import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import type { NotificationType } from "./notifications.js";

export const NOTIFICATION_PREFERENCE_CATEGORIES = [
  "projects",
  "team",
  "billing",
  "audits",
] as const;

export type NotificationPreferenceCategory = (typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number];

export type NotificationPreferences = Record<NotificationPreferenceCategory, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  projects: true,
  team: true,
  billing: true,
  audits: true,
};

const CATEGORY_TYPES: Record<NotificationPreferenceCategory, readonly string[]> = {
  projects: [
    "project_renamed",
    "project_archived",
    "project_deleted",
    "project_restored",
    "project_pinned",
    "project_unpinned",
  ],
  team: ["team_invite", "team_invite_accepted"],
  billing: [
    "credit_low",
    "credit_depleted",
    "credits_low",
    "payment_received",
    "subscription_expired",
    "subscription_renewed",
  ],
  audits: ["audit_completed", "competitor_added"],
};

const ALWAYS_ON_TYPES = new Set<string>(["system", "welcome"]);

const typeToCategory = new Map<string, NotificationPreferenceCategory>();
for (const category of NOTIFICATION_PREFERENCE_CATEGORIES) {
  for (const type of CATEGORY_TYPES[category]) {
    typeToCategory.set(type, category);
  }
}

export function mergeNotificationPreferences(
  raw: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  return {
    projects: raw?.projects ?? DEFAULT_NOTIFICATION_PREFERENCES.projects,
    team: raw?.team ?? DEFAULT_NOTIFICATION_PREFERENCES.team,
    billing: raw?.billing ?? DEFAULT_NOTIFICATION_PREFERENCES.billing,
    audits: raw?.audits ?? DEFAULT_NOTIFICATION_PREFERENCES.audits,
  };
}

export function notificationCategoryForType(type: string): NotificationPreferenceCategory | null {
  return typeToCategory.get(type) ?? null;
}

export function isNotificationTypeEnabled(
  preferences: NotificationPreferences,
  type: string,
): boolean {
  if (ALWAYS_ON_TYPES.has(type)) return true;
  const category = notificationCategoryForType(type);
  if (!category) return true;
  return preferences[category];
}

export async function getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const [profile] = await db
    .select({ notificationPreferences: userProfilesTable.notificationPreferences })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);

  return mergeNotificationPreferences(
    profile?.notificationPreferences as Partial<NotificationPreferences> | null | undefined,
  );
}

export async function isNotificationDeliveryEnabled(
  userId: string,
  type: NotificationType | string,
): Promise<boolean> {
  const preferences = await getUserNotificationPreferences(userId);
  return isNotificationTypeEnabled(preferences, type);
}

export async function updateUserNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const current = await getUserNotificationPreferences(userId);
  const merged = mergeNotificationPreferences({
    ...current,
    ...patch,
  });

  const [existing] = await db
    .select({ id: userProfilesTable.id })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(userProfilesTable)
      .set({ notificationPreferences: merged, updatedAt: new Date() })
      .where(eq(userProfilesTable.userId, userId));
  } else {
    await db.insert(userProfilesTable).values({
      userId,
      notificationPreferences: merged,
    });
  }

  return merged;
}

export function filterNotificationsByPreferences<
  T extends { type: string },
>(notifications: T[], preferences: NotificationPreferences): T[] {
  return notifications.filter((n) => isNotificationTypeEnabled(preferences, n.type));
}
