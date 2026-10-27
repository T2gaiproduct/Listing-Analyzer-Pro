import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { resolvePublicSiteOrigin } from "./email-template-layout.js";

const CACHE_TTL_MS = 60_000;

let cachedLogoUrl: { url: string; fetchedAt: number } | null = null;

/** Clear after Admin → Platform branding changes so the next email uses the new logo. */
export function clearEmailLogoUrlCache(): void {
  cachedLogoUrl = null;
}

/** Build an absolute logo URL for email clients from a settings value or public path. */
export function buildAbsoluteEmailLogoUrl(
  stored: string | null | undefined,
  origin: string,
): string {
  const base = origin.trim().replace(/\/$/, "");
  const trimmed = stored?.trim();
  if (!trimmed) return `${base}/logo.png`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return `${base}/${trimmed}`;
}

/** Admin site logo when set; otherwise `{origin}/logo.png`. */
export async function resolveEmailLogoUrl(): Promise<string> {
  const now = Date.now();
  if (cachedLogoUrl && now - cachedLogoUrl.fetchedAt < CACHE_TTL_MS) {
    return cachedLogoUrl.url;
  }

  const origin = resolvePublicSiteOrigin();
  try {
    const [row] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "site_logo_url"))
      .limit(1);
    const url = buildAbsoluteEmailLogoUrl(row?.value, origin);
    cachedLogoUrl = { url, fetchedAt: now };
    return url;
  } catch {
    return buildAbsoluteEmailLogoUrl(null, origin);
  }
}
