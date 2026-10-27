import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { inArray } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

export const emailFrom = process.env.EMAIL_FROM ?? "Ecommerce Guru <noreply@sellerlens.io>";

const EMAIL_SETTING_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_username",
  "smtp_password",
  "email_from_name",
  "email_from_address",
  "email_reply_to",
  "email_notifications_enabled",
] as const;

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
  replyTo?: string;
};

let cachedTransport: { key: string; transport: nodemailer.Transporter<SMTPTransport.SentMessageInfo> } | null = null;

function formatFrom(name: string, address: string): string {
  const trimmedName = name.trim();
  const trimmedAddress = address.trim();
  if (trimmedName && trimmedAddress) return `${trimmedName} <${trimmedAddress}>`;
  if (trimmedAddress) return trimmedAddress;
  return emailFrom;
}

function parsePort(value: string | undefined, fallback = 587): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function transportCacheKey(config: SmtpConfig): string {
  const user = config.auth?.user ?? "";
  return `${config.host}:${config.port}:${config.secure}:${user}`;
}

async function resolveSmtpConfigFromDb(): Promise<SmtpConfig | null> {
  const rows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...EMAIL_SETTING_KEYS]));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const host = map.smtp_host?.trim();
  if (!host) return null;

  const port = parsePort(map.smtp_port);
  const username = map.smtp_username?.trim() ?? "";
  const password = map.smtp_password?.trim() ?? "";
  if (username && (!password || password === "***")) return null;

  const fromName = map.email_from_name?.trim() || "Ecommerce Guru";
  const fromAddress = map.email_from_address?.trim();
  const replyTo = map.email_reply_to?.trim();

  return {
    host,
    port,
    secure: port === 465,
    auth: username ? { user: username, pass: password } : undefined,
    from: fromAddress ? formatFrom(fromName, fromAddress) : emailFrom,
    replyTo: replyTo || undefined,
  };
}

function resolveSmtpConfigFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = parsePort(process.env.SMTP_PORT);
  const username = process.env.SMTP_USER?.trim() ?? "";
  const password = process.env.SMTP_PASS?.trim() ?? "";
  if (username && !password) return null;

  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  return {
    host,
    port,
    secure: port === 465,
    auth: username ? { user: username, pass: password } : undefined,
    from: process.env.EMAIL_FROM?.trim() || emailFrom,
    replyTo: replyTo || undefined,
  };
}

async function resolveSmtpConfig(): Promise<SmtpConfig | null> {
  const fromEnv = resolveSmtpConfigFromEnv();
  if (fromEnv) return fromEnv;
  return resolveSmtpConfigFromDb();
}

export function clearSmtpTransportCache(): void {
  cachedTransport = null;
}

function smtpConfigFromMap(map: Record<string, string | undefined>): SmtpConfig | null {
  const host = map.smtp_host?.trim();
  if (!host) return null;

  const port = parsePort(map.smtp_port);
  const username = map.smtp_username?.trim() ?? "";
  const password = map.smtp_password?.trim() ?? "";
  if (username && (!password || password === "***")) return null;

  const fromName = map.email_from_name?.trim() || "Ecommerce Guru";
  const fromAddress = map.email_from_address?.trim();
  const replyTo = map.email_reply_to?.trim();

  return {
    host,
    port,
    secure: port === 465,
    auth: username ? { user: username, pass: password } : undefined,
    from: fromAddress ? formatFrom(fromName, fromAddress) : emailFrom,
    replyTo: replyTo || undefined,
  };
}

/** Merge DB email settings with optional admin form overrides (empty password = keep DB secret). */
export async function resolveSmtpConfigForAdminTest(
  overrides?: Record<string, string>,
): Promise<{ config: SmtpConfig | null; configSource: "env" | "database" | "form"; hint?: string }> {
  const fromEnv = resolveSmtpConfigFromEnv();
  if (fromEnv) {
    return {
      config: fromEnv,
      configSource: "env",
      hint: "Server .env SMTP_* overrides Admin Email Settings. Test uses environment variables.",
    };
  }

  const rows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...EMAIL_SETTING_KEYS]));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const o = overrides ?? {};
  for (const [key, value] of Object.entries(o)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (key === "smtp_password" && trimmed === "") continue;
    if (trimmed !== "") map[key] = trimmed;
  }

  const config = smtpConfigFromMap(map);
  const usedForm = Object.entries(o).some(([k, v]) => typeof v === "string" && v.trim() !== "" && k !== "smtp_password");
  return {
    config,
    configSource: usedForm ? "form" : "database",
    hint:
      !config && map.smtp_username?.trim() && !map.smtp_password?.trim()
        ? "SMTP password missing. Save settings with a password or re-enter it before testing."
        : undefined,
  };
}

function getTransport(config: SmtpConfig): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  const key = transportCacheKey(config);
  if (cachedTransport?.key === key) return cachedTransport.transport;

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    ...(config.port === 587 ? { requireTLS: true } : {}),
    tls: { minVersion: "TLSv1.2" },
  });

  cachedTransport = { key, transport };
  return transport;
}

async function sendMailWithConfig(
  config: SmtpConfig,
  mail: { to: string; subject: string; html: string; replyTo?: string },
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const transport = getTransport(config);
    const options: Mail.Options = {
      from: config.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    };
    const resolvedReplyTo = mail.replyTo ?? config.replyTo;
    if (resolvedReplyTo) options.replyTo = resolvedReplyTo;

    const result = await transport.sendMail(options);
    return { success: true, id: result.messageId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
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
  const config = await resolveSmtpConfig();
  if (!config) {
    return {
      success: false,
      error: "Email is not configured (set SMTP in Admin → Email Settings or SMTP_HOST/SMTP_USER/SMTP_PASS env)",
    };
  }

  return sendMailWithConfig(config, { to, subject, html, replyTo });
}

export async function sendAdminTestEmail(input: {
  to: string;
  settings?: Record<string, string>;
}): Promise<{
  success: boolean;
  error?: string;
  id?: string;
  configSource?: string;
  hint?: string;
}> {
  clearSmtpTransportCache();
  const { config, configSource, hint } = await resolveSmtpConfigForAdminTest(input.settings);
  if (!config) {
    return {
      success: false,
      error:
        hint ??
        "Email is not configured. Set SMTP host, port, username, and password, then save or test again.",
      configSource,
      hint,
    };
  }

  const html = `<p>This is a test email from <strong>Ecommerce Guru</strong> admin settings.</p>
<p>If you received this, SMTP is working for sign-up OTP and notifications.</p>
<p style="color:#64748b;font-size:12px;">Sent at ${new Date().toISOString()} · source: ${configSource}</p>`;

  const result = await sendMailWithConfig(config, {
    to: input.to,
    subject: "Ecommerce Guru — SMTP test email",
    html,
  });

  return { ...result, configSource, hint: result.success ? hint : undefined };
}
