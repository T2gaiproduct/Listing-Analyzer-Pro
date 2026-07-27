import { Resend } from "resend";
import { inArray } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

export const emailFrom = process.env.EMAIL_FROM ?? "SellerLens <noreply@listingauditor.com>";

const EMAIL_SETTING_KEYS = ["resend_api_key", "email_from_name", "email_from_address", "email_reply_to", "email_notifications_enabled"] as const;

let cachedResend: { apiKey: string; client: Resend } | null = null;

async function resolveResendConfig(): Promise<{ apiKey: string; from: string; replyTo?: string } | null> {
  const envKey = process.env.RESEND_API_KEY?.trim();
  if (envKey) {
    const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;
    return { apiKey: envKey, from: process.env.EMAIL_FROM?.trim() || emailFrom, replyTo };
  }

  const rows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...EMAIL_SETTING_KEYS]));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const apiKey = map.resend_api_key?.trim();
  if (!apiKey || apiKey === "***") return null;

  const fromName = map.email_from_name?.trim() || "SellerLens";
  const fromAddress = map.email_from_address?.trim();
  const from = fromAddress ? `${fromName} <${fromAddress}>` : emailFrom;
  const replyTo = map.email_reply_to?.trim() || process.env.EMAIL_REPLY_TO?.trim() || undefined;
  return { apiKey, from, replyTo };
}

async function getResendClient(apiKey: string): Promise<Resend> {
  if (cachedResend?.apiKey === apiKey) return cachedResend.client;
  const client = new Resend(apiKey);
  cachedResend = { apiKey, client };
  return client;
}

export async function isEmailNotificationsEnabled(): Promise<boolean> {
  const env = process.env.EMAIL_NOTIFICATIONS_ENABLED?.trim().toLowerCase();
  if (env === "false" || env === "0") return false;

  const rows = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(inArray(settingsTable.key, ["email_notifications_enabled"]));
  const value = rows[0]?.value?.trim().toLowerCase();
  if (value === "false" || value === "0") return false;
  return true;
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const config = await resolveResendConfig();
  if (!config) {
    return { success: false, error: "Email is not configured (set RESEND_API_KEY or Admin → Email Settings)" };
  }

  try {
    const client = await getResendClient(config.apiKey);
    const result = await client.emails.send({
      from: config.from,
      to,
      subject,
      html,
      replyTo: replyTo ?? config.replyTo ?? undefined,
    });
    return { success: true, id: result.data?.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
