export const ANNOUNCEMENT_PROMO_CATEGORY = "announcement";

export const ANNOUNCEMENT_PROMO_KEYS = {
  enabled: "announcement_promo_enabled",
  text: "announcement_promo_text",
  code: "announcement_promo_code",
  linkText: "announcement_promo_link_text",
  linkUrl: "announcement_promo_link_url",
} as const;

export const ANNOUNCEMENT_PROMO_DEFAULTS = {
  enabled: "true",
  text: "Launch offer: Get 20% off any plan with code",
  code: "LAUNCH20",
  linkText: "See pricing",
  linkUrl: "/pricing",
} as const;

export interface AnnouncementPromo {
  enabled: boolean;
  text: string;
  code: string;
  linkText: string;
  linkUrl: string;
}

export function announcementPromoFormDefaults(
  settings: Record<string, string> = {},
): Record<string, string> {
  return {
    [ANNOUNCEMENT_PROMO_KEYS.enabled]: settings[ANNOUNCEMENT_PROMO_KEYS.enabled] ?? ANNOUNCEMENT_PROMO_DEFAULTS.enabled,
    [ANNOUNCEMENT_PROMO_KEYS.text]: settings[ANNOUNCEMENT_PROMO_KEYS.text] ?? ANNOUNCEMENT_PROMO_DEFAULTS.text,
    [ANNOUNCEMENT_PROMO_KEYS.code]: settings[ANNOUNCEMENT_PROMO_KEYS.code] ?? ANNOUNCEMENT_PROMO_DEFAULTS.code,
    [ANNOUNCEMENT_PROMO_KEYS.linkText]: settings[ANNOUNCEMENT_PROMO_KEYS.linkText] ?? ANNOUNCEMENT_PROMO_DEFAULTS.linkText,
    [ANNOUNCEMENT_PROMO_KEYS.linkUrl]: settings[ANNOUNCEMENT_PROMO_KEYS.linkUrl] ?? ANNOUNCEMENT_PROMO_DEFAULTS.linkUrl,
  };
}
