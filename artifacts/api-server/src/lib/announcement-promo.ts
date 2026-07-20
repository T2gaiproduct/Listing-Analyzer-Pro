import { eq } from "drizzle-orm";
import { cmsContent, db, settingsTable } from "@workspace/db";

export const ANNOUNCEMENT_PROMO_CATEGORY = "announcement";

export const ANNOUNCEMENT_PROMO_KEYS = {
  enabled: "announcement_promo_enabled",
  text: "announcement_promo_text",
  code: "announcement_promo_code",
  linkText: "announcement_promo_link_text",
  linkUrl: "announcement_promo_link_url",
} as const;

export const ANNOUNCEMENT_PROMO_DEFAULTS = {
  enabled: true,
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

function parseEnabled(value: string | undefined): boolean {
  return value !== "false" && value !== "0";
}

function settingsMap(rows: Array<{ key: string; value: string | null }>): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.key, row.value ?? ""]));
}

async function loadCmsPromoFallback(): Promise<Partial<AnnouncementPromo>> {
  const rows = await db
    .select()
    .from(cmsContent)
    .where(eq(cmsContent.pageSlug, "homepage"));

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[`${row.sectionKey}.${row.fieldKey}`] = row.value ?? "";
  }

  const fallback: Partial<AnnouncementPromo> = {};
  if ("sections.promo.enabled" in map) fallback.enabled = parseEnabled(map["sections.promo.enabled"]);
  if (map["promo.text"]) fallback.text = map["promo.text"];
  if (map["promo.code"]) fallback.code = map["promo.code"];
  if (map["promo.link_text"]) fallback.linkText = map["promo.link_text"];
  if (map["promo.link_url"]) fallback.linkUrl = map["promo.link_url"];
  return fallback;
}

export async function getAnnouncementPromo(): Promise<AnnouncementPromo> {
  const keys = Object.values(ANNOUNCEMENT_PROMO_KEYS);
  const rows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.category, ANNOUNCEMENT_PROMO_CATEGORY));

  const settings = settingsMap(rows.filter((row) => keys.includes(row.key as typeof keys[number])));
  const hasAnySetting = keys.some((key) => settings[key]?.trim());

  if (hasAnySetting) {
    return {
      enabled: parseEnabled(settings[ANNOUNCEMENT_PROMO_KEYS.enabled] ?? "true"),
      text: settings[ANNOUNCEMENT_PROMO_KEYS.text] || ANNOUNCEMENT_PROMO_DEFAULTS.text,
      code: settings[ANNOUNCEMENT_PROMO_KEYS.code] || ANNOUNCEMENT_PROMO_DEFAULTS.code,
      linkText: settings[ANNOUNCEMENT_PROMO_KEYS.linkText] || ANNOUNCEMENT_PROMO_DEFAULTS.linkText,
      linkUrl: settings[ANNOUNCEMENT_PROMO_KEYS.linkUrl] || ANNOUNCEMENT_PROMO_DEFAULTS.linkUrl,
    };
  }

  const cmsFallback = await loadCmsPromoFallback();
  return {
    enabled: cmsFallback.enabled ?? ANNOUNCEMENT_PROMO_DEFAULTS.enabled,
    text: cmsFallback.text ?? ANNOUNCEMENT_PROMO_DEFAULTS.text,
    code: cmsFallback.code ?? ANNOUNCEMENT_PROMO_DEFAULTS.code,
    linkText: cmsFallback.linkText ?? ANNOUNCEMENT_PROMO_DEFAULTS.linkText,
    linkUrl: cmsFallback.linkUrl ?? ANNOUNCEMENT_PROMO_DEFAULTS.linkUrl,
  };
}
