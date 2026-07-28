import { eq, sql } from "drizzle-orm";
import { db, teamMembersTable, userProfilesTable } from "@workspace/db";
import { clerkAccountExistsForEmail, fetchClerkUserIdByEmail } from "./clerk-user.js";
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

export function isNotificationPreferencesColumnMissingError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("notification_preferences")
    && (message.includes("does not exist")
      || message.includes("Failed query")
      || message.includes("relation")
      || message.includes("column"));
}

export const NOTIFICATION_PREFS_MIGRATION_HINT =
  "Database is missing notification_preferences column. Run: pnpm --filter @workspace/db run push";

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
  try {
    const [profile] = await db
      .select({ notificationPreferences: userProfilesTable.notificationPreferences })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    return mergeNotificationPreferences(
      profile?.notificationPreferences as Partial<NotificationPreferences> | null | undefined,
    );
  } catch (err) {
    if (isNotificationPreferencesColumnMissingError(err)) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
    throw err;
  }
}

export async function isNotificationDeliveryEnabled(
  userId: string,
  type: NotificationType | string,
): Promise<boolean> {
  const preferences = await getUserNotificationPreferences(userId);
  return isNotificationTypeEnabled(preferences, type);
}

async function resolveUserIdForEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const clerkUserId = await fetchClerkUserIdByEmail(normalized);
  if (clerkUserId) return clerkUserId;

  const [member] = await db
    .select({ memberUserId: teamMembersTable.memberUserId })
    .from(teamMembersTable)
    .where(sql`lower(${teamMembersTable.invitedEmail}) = ${normalized}`)
    .limit(1);

  return member?.memberUserId ?? null;
}

/**
 * Whether to send a team invite email to this address.
 * New users (no Clerk account) still receive the invite email so they can sign up and accept.
 * Existing users with team notifications disabled do not.
 */
export async function shouldSendTeamInviteEmailToAddress(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const userId = await resolveUserIdForEmail(normalized);
  if (userId) {
    return await isNotificationDeliveryEnabled(userId, "team_invite");
  }

  // No mapped user id — only email brand-new addresses that do not already have a Clerk account.
  return !(await clerkAccountExistsForEmail(normalized));
}

export async function shouldSendTeamWelcomeEmailToUser(userId: string): Promise<boolean> {
  return await isNotificationDeliveryEnabled(userId, "team_invite_accepted");
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

  try {
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
  } catch (err) {
    if (isNotificationPreferencesColumnMissingError(err)) {
      throw new Error(NOTIFICATION_PREFS_MIGRATION_HINT);
    }
    throw err;
  }

  return merged;
}

export function filterNotificationsByPreferences<
  T extends { type: string },
>(notifications: T[], preferences: NotificationPreferences): T[] {
  return notifications.filter((n) => isNotificationTypeEnabled(preferences, n.type));
}
