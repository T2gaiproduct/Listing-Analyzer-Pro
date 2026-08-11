import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { inArray } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

export const emailFrom = process.env.EMAIL_FROM ?? "Seller Lens <noreply@sellerlens.io>";

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

  const fromName = map.email_from_name?.trim() || "Seller Lens";
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

function getTransport(config: SmtpConfig): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  const key = transportCacheKey(config);
  if (cachedTransport?.key === key) return cachedTransport.transport;

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  cachedTransport = { key, transport };
  return transport;
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

  try {
    const transport = getTransport(config);
    const mail: Mail.Options = {
      from: config.from,
      to,
      subject,
      html,
    };
    const resolvedReplyTo = replyTo ?? config.replyTo;
    if (resolvedReplyTo) mail.replyTo = resolvedReplyTo;

    const result = await transport.sendMail(mail);
    return { success: true, id: result.messageId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
