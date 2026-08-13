import { eq, sql, and, isNotNull, desc } from "drizzle-orm";
import { db, teamMembersTable, userProfilesTable } from "@workspace/db";
import { clerkAccountExistsForEmail, fetchClerkUserIdByEmail } from "./clerk-user.js";
import { syncUserLoginEmail } from "./user-profile.js";
import type { NotificationType } from "./notifications.js";

export const NOTIFICATION_PREFERENCE_CATEGORIES = [
  "projects",
  "team",
  "billing",
  "audits",
  "admin",
] as const;

export type NotificationPreferenceCategory = (typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number];

export type NotificationEmailPreferences = Record<NotificationPreferenceCategory, boolean>;

export type NotificationPreferences = Record<NotificationPreferenceCategory, boolean> & {
  email?: Partial<NotificationEmailPreferences>;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  projects: true,
  team: true,
  billing: true,
  audits: true,
  admin: true,
  email: {
    projects: true,
    team: true,
    billing: true,
    audits: true,
    admin: true,
  },
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
  admin: [
    "support_ticket_new",
    "admin_role_invite",
    "admin_role_assigned",
    "admin_role_updated",
    "form_submission_new",
  ],
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

function mergeEmailNotificationPreferences(
  raw: Partial<NotificationEmailPreferences> | null | undefined,
  channelDefaults: NotificationPreferences,
): NotificationEmailPreferences {
  return {
    projects: raw?.projects ?? channelDefaults.projects,
    team: raw?.team ?? channelDefaults.team,
    billing: raw?.billing ?? channelDefaults.billing,
    audits: raw?.audits ?? channelDefaults.audits,
    admin: raw?.admin ?? channelDefaults.admin,
  };
}

export function mergeNotificationPreferences(
  raw: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  const channels = {
    projects: raw?.projects ?? DEFAULT_NOTIFICATION_PREFERENCES.projects,
    team: raw?.team ?? DEFAULT_NOTIFICATION_PREFERENCES.team,
    billing: raw?.billing ?? DEFAULT_NOTIFICATION_PREFERENCES.billing,
    audits: raw?.audits ?? DEFAULT_NOTIFICATION_PREFERENCES.audits,
    admin: raw?.admin ?? DEFAULT_NOTIFICATION_PREFERENCES.admin,
  };
  return {
    ...channels,
    email: mergeEmailNotificationPreferences(raw?.email, channels),
  };
}

export function notificationCategoryForType(type: string): NotificationPreferenceCategory | null {
  return typeToCategory.get(type) ?? null;
}

/** Admin / log display category including system and unmapped types. */
export function notificationDisplayCategory(type: string): NotificationPreferenceCategory | "system" | "other" {
  const mapped = notificationCategoryForType(type);
  if (mapped) return mapped;
  if (ALWAYS_ON_TYPES.has(type) || type === "promo") return "system";
  return "other";
}

export function allKnownNotificationTypes(): string[] {
  const fromCategories = NOTIFICATION_PREFERENCE_CATEGORIES.flatMap((c) => CATEGORY_TYPES[c]);
  return [...new Set([...fromCategories, ...ALWAYS_ON_TYPES, "promo"])];
}

/** Types for admin list filter; null = no filter (all). */
export function notificationTypesForAdminCategory(category: string): string[] | null {
  if (!category || category === "all") return null;
  if (category === "system") return [...ALWAYS_ON_TYPES, "promo"];
  if ((NOTIFICATION_PREFERENCE_CATEGORIES as readonly string[]).includes(category)) {
    return [...CATEGORY_TYPES[category as NotificationPreferenceCategory]];
  }
  return null;
}

export async function enrichNotificationsForAdminLog<
  T extends { type: string; userId: string | null },
>(notifications: T[]): Promise<Array<T & { category: string; userWouldSee: boolean | null }>> {
  const userIds = [...new Set(
    notifications.map((n) => n.userId).filter((id): id is string => Boolean(id)),
  )];
  const prefsByUser = new Map<string, NotificationPreferences>();
  for (const uid of userIds) {
    prefsByUser.set(uid, await getUserNotificationPreferences(uid));
  }

  return notifications.map((n) => ({
    ...n,
    category: notificationDisplayCategory(n.type),
    userWouldSee: n.userId
      ? isNotificationTypeEnabled(
        prefsByUser.get(n.userId) ?? DEFAULT_NOTIFICATION_PREFERENCES,
        n.type,
      )
      : null,
  }));
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

export function isNotificationEmailTypeEnabled(
  preferences: NotificationPreferences,
  type: string,
): boolean {
  if (ALWAYS_ON_TYPES.has(type)) return true;
  const category = notificationCategoryForType(type);
  if (!category) return true;
  const emailPref = preferences.email?.[category];
  if (emailPref !== undefined) return emailPref;
  return preferences[category];
}

export async function isNotificationEmailDeliveryEnabled(
  userId: string,
  type: string,
): Promise<boolean> {
  const preferences = await getUserNotificationPreferences(userId);
  return isNotificationEmailTypeEnabled(preferences, type);
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

  const [byLogin] = await db
    .select({ userId: userProfilesTable.userId })
    .from(userProfilesTable)
    .where(sql`lower(${userProfilesTable.loginEmail}) = ${normalized}`)
    .limit(1);
  if (byLogin?.userId) return byLogin.userId;

  const clerkUserId = await fetchClerkUserIdByEmail(normalized);
  if (clerkUserId) return clerkUserId;

  const [member] = await db
    .select({ memberUserId: teamMembersTable.memberUserId })
    .from(teamMembersTable)
    .where(and(
      sql`lower(${teamMembersTable.invitedEmail}) = ${normalized}`,
      isNotNull(teamMembersTable.memberUserId),
    ))
    .orderBy(desc(teamMembersTable.acceptedAt))
    .limit(1);

  return member?.memberUserId ?? null;
}

async function findProfilePrefsByLoginEmail(normalized: string): Promise<NotificationPreferences | null> {
  const [profile] = await db
    .select({ notificationPreferences: userProfilesTable.notificationPreferences })
    .from(userProfilesTable)
    .where(sql`lower(${userProfilesTable.loginEmail}) = ${normalized}`)
    .limit(1);

  if (!profile) return null;
  return mergeNotificationPreferences(
    profile.notificationPreferences as Partial<NotificationPreferences> | null | undefined,
  );
}

/**
 * Whether to send a team invite email to this address.
 * New users (no Clerk account) still receive the invite email so they can sign up and accept.
 * Existing users with team notifications disabled do not.
 */
export async function shouldSendTeamInviteEmailToAddress(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const prefsByLoginEmail = await findProfilePrefsByLoginEmail(normalized);
  if (prefsByLoginEmail) {
    return isNotificationEmailTypeEnabled(prefsByLoginEmail, "team_invite");
  }

  const userId = await resolveUserIdForEmail(normalized);
  if (userId) {
    return await isNotificationEmailDeliveryEnabled(userId, "team_invite");
  }

  // No mapped user id — only email brand-new addresses that do not already have a Clerk account.
  return !(await clerkAccountExistsForEmail(normalized));
}

export async function shouldSendTeamWelcomeEmailToUser(userId: string): Promise<boolean> {
  return await isNotificationEmailDeliveryEnabled(userId, "team_invite_accepted");
}

export async function updateUserNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferences>,
  options?: { loginEmail?: string | null },
): Promise<NotificationPreferences> {
  if (options?.loginEmail) {
    await syncUserLoginEmail(userId, options.loginEmail);
  }
  const current = await getUserNotificationPreferences(userId);
  const mergedChannels = mergeNotificationPreferences({
    projects: patch.projects ?? current.projects,
    team: patch.team ?? current.team,
    billing: patch.billing ?? current.billing,
    audits: patch.audits ?? current.audits,
    admin: patch.admin ?? current.admin,
  });
  const merged = mergeNotificationPreferences({
    ...mergedChannels,
    email: {
      ...mergedChannels.email,
      ...patch.email,
    },
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
