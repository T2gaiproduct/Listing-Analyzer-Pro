export const NOTIFICATION_PREFERENCE_CATEGORIES = [
  "projects",
  "team",
  "billing",
  "audits",
] as const;

export type NotificationPreferenceCategory = (typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number];

export type NotificationPreferences = Record<NotificationPreferenceCategory, boolean>;

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
    description: "Invitations to join a workspace and team membership updates. If you already have an account, turning this off blocks team invite and welcome emails to your login email.",
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
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  projects: true,
  team: true,
  billing: true,
  audits: true,
};

export const NOTIFICATION_CATEGORY_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "projects", label: NOTIFICATION_PREFERENCE_META.projects.label },
  { value: "team", label: NOTIFICATION_PREFERENCE_META.team.label },
  { value: "billing", label: NOTIFICATION_PREFERENCE_META.billing.label },
  { value: "audits", label: NOTIFICATION_PREFERENCE_META.audits.label },
  { value: "system", label: "System & announcements" },
  { value: "other", label: "Other / legacy types" },
];

export const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  projects: NOTIFICATION_PREFERENCE_META.projects.label,
  team: NOTIFICATION_PREFERENCE_META.team.label,
  billing: NOTIFICATION_PREFERENCE_META.billing.label,
  audits: NOTIFICATION_PREFERENCE_META.audits.label,
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
  system: ["system", "welcome", "promo"],
};
