import { CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES } from "@/lib/notification-preferences";

type CustomerNotificationPreferenceCategory =
  (typeof CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES)[number];

function isCustomerNotificationCategory(
  value: string,
): value is CustomerNotificationPreferenceCategory {
  return (CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES as readonly string[]).includes(value);
}

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
  if (raw && isCustomerNotificationCategory(raw)) {
    return raw;
  }
  return "general";
}

export function isNotificationSettingsTab(
  tab: SettingsPageTab,
): tab is CustomerNotificationPreferenceCategory {
  return isCustomerNotificationCategory(tab);
}

export function settingsHrefForTab(tab: SettingsPageTab): string {
  if (tab === "general") return "/settings";
  return `/settings?tab=${tab}`;
}