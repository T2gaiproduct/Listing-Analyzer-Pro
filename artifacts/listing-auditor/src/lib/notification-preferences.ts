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
    description: "Invitations to join a workspace and team membership updates.",
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
