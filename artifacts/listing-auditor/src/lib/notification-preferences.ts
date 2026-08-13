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

export const NOTIFICATION_PREFERENCE_META: Record<
  NotificationPreferenceCategory,
  { label: string; description: string; examples: string }
> = {
  projects: {
    label: "Project activity",
    description: "Pin, rename, archive, delete, and restore updates for your projects.",
    examples: "Pinned project, renamed project, archived project",
  },
  team: {
    label: "Team invites & updates",
    description: "Invitations to join a workspace and team membership updates. If you already have an account, turning email off blocks team invite and welcome emails to your login email.",
    examples: "Team invite emails, invite accepted",
  },
  billing: {
    label: "Billing & credits",
    description: "Credit balance warnings, payments, and subscription updates.",
    examples: "Low credits, credits depleted, payment received",
  },
  audits: {
    label: "Audits & competitors",
    description: "Audit completion and competitor analysis updates.",
    examples: "Audit completed, competitor added",
  },
  admin: {
    label: "Admin & platform alerts",
    description: "Support tickets, admin role changes, and other platform events for administrators.",
    examples: "New support ticket, admin role invitation, role assignment",
  },
};

/** Categories shown on customer settings — excludes admin-only alerts. */
export const CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES = [
  "projects",
  "team",
  "billing",
  "audits",
] as const;

const DEFAULT_EMAIL_NOTIFICATION_PREFERENCES: NotificationEmailPreferences = {
  projects: true,
  team: true,
  billing: true,
  audits: true,
  admin: true,
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  projects: true,
  team: true,
  billing: true,
  audits: true,
  admin: true,
  email: DEFAULT_EMAIL_NOTIFICATION_PREFERENCES,
};

function mergeEmailNotificationPreferences(
  raw: Partial<NotificationEmailPreferences> | null | undefined,
): NotificationEmailPreferences {
  const defaults = DEFAULT_EMAIL_NOTIFICATION_PREFERENCES;
  return {
    projects: raw?.projects ?? defaults.projects,
    team: raw?.team ?? defaults.team,
    billing: raw?.billing ?? defaults.billing,
    audits: raw?.audits ?? defaults.audits,
    admin: raw?.admin ?? defaults.admin,
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
    email: mergeEmailNotificationPreferences(raw?.email),
  };
}

export const NOTIFICATION_CATEGORY_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "projects", label: NOTIFICATION_PREFERENCE_META.projects.label },
  { value: "team", label: NOTIFICATION_PREFERENCE_META.team.label },
  { value: "billing", label: NOTIFICATION_PREFERENCE_META.billing.label },
  { value: "audits", label: NOTIFICATION_PREFERENCE_META.audits.label },
  { value: "admin", label: NOTIFICATION_PREFERENCE_META.admin.label },
  { value: "system", label: "System & announcements" },
  { value: "other", label: "Other / legacy types" },
];

export const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  projects: NOTIFICATION_PREFERENCE_META.projects.label,
  team: NOTIFICATION_PREFERENCE_META.team.label,
  billing: NOTIFICATION_PREFERENCE_META.billing.label,
  audits: NOTIFICATION_PREFERENCE_META.audits.label,
  admin: NOTIFICATION_PREFERENCE_META.admin.label,
  system: "System",
  other: "Other",
};

/** Notification types grouped for admin send dialog */
export const ADMIN_NOTIFICATION_TYPES_BY_CATEGORY: Record<string, string[]> = {
  projects: [
    "project_pinned",
    "project_renamed",
    "project_archived",
    "project_deleted",
    "project_restored",
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
    "payment_failed",
    "payment_success",
    "credit_expired",
    "plan_expiring",
  ],
  audits: ["audit_completed", "competitor_added"],
  admin: [
    "support_ticket_new",
    "admin_role_invite",
    "admin_role_assigned",
    "admin_role_updated",
    "form_submission_new",
  ],
  system: ["system", "welcome", "promo"],
};
