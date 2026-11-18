import {
  CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES,
  type NotificationPreferenceCategory,
} from "@/lib/notification-preferences";

export const SETTINGS_TAB_MARKETPLACES = "marketplaces";
export const SETTINGS_MARKETPLACES_HREF = `/settings?tab=${SETTINGS_TAB_MARKETPLACES}`;

export type SettingsPageTab =
  | "general"
  | typeof SETTINGS_TAB_MARKETPLACES
  | (typeof CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES)[number];

export const SETTINGS_PAGE_TAB_ORDER: SettingsPageTab[] = [
  "general",
  SETTINGS_TAB_MARKETPLACES,
  ...CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES,
];

export const SETTINGS_PAGE_TAB_LABELS: Record<SettingsPageTab, string> = {
  general: "General",
  marketplaces: "Marketplaces",
  projects: "Projects",
  team: "Team",
  billing: "Billing",
  audits: "Audits",
};

export function parseSettingsPageTab(raw: string | null | undefined): SettingsPageTab {
  if (raw === SETTINGS_TAB_MARKETPLACES) return SETTINGS_TAB_MARKETPLACES;
  if (
    raw
    && CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES.includes(raw as NotificationPreferenceCategory)
  ) {
    return raw as SettingsPageTab;
  }
  return "general";
}

export function isNotificationSettingsTab(
  tab: SettingsPageTab,
): tab is (typeof CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES)[number] {
  return CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES.includes(tab as NotificationPreferenceCategory);
}

export function settingsHrefForTab(tab: SettingsPageTab): string {
  if (tab === "general") return "/settings";
  return `/settings?tab=${tab}`;
}