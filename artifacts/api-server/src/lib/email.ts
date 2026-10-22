import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type SMTPConnection from "nodemailer/lib/smtp-connection";
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

export type SmtpConfigurationStatus = {
  configured: boolean;
  source: "env" | "database" | "none";
  envOverridesDatabase: boolean;
  host?: string;
  port?: number;
  from?: string;
  hasUsername: boolean;
  hasPassword: boolean;
  issue?: string;
};

let cachedTransport: { key: string; transport: nodemailer.Transporter<SMTPTransport.SentMessageInfo> } | null = null;

export function clearSmtpTransportCache(): void {
  cachedTransport = null;
}

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
  const passLen = config.auth?.pass?.length ?? 0;
  return `${config.host}:${config.port}:${config.secure}:${user}:${passLen}`;
}

function smtpTransportOptions(config: SmtpConfig): SMTPConnection.Options {
  const secure = config.port === 465;
  return {
    host: config.host,
    port: config.port,
    secure,
    requireTLS: !secure && config.port === 587,
    auth: config.auth,
    tls: { minVersion: "TLSv1.2" },
  };
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

async function describeUnconfiguredSmtp(): Promise<string> {
  if (process.env.SMTP_HOST?.trim()) {
    if (process.env.SMTP_USER?.trim() && !process.env.SMTP_PASS?.trim()) {
      return "Server SMTP_HOST/SMTP_USER are set but SMTP_PASS is missing in environment (overrides Admin → Email Settings).";
    }
    return "Server SMTP_* environment variables override the admin dashboard — check SMTP_HOST, SMTP_USER, and SMTP_PASS on the API host.";
  }

  const rows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(inArray(settingsTable.key, ["smtp_host", "smtp_username", "smtp_password"]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!map.smtp_host?.trim()) {
    return "SMTP host is empty — save Admin → Email Settings (SMTP host, port, username, password).";
  }
  const username = map.smtp_username?.trim() ?? "";
  const password = map.smtp_password?.trim() ?? "";
  if (username && !password) {
    return "SMTP password is not saved — open Admin → Email Settings, re-enter the mailbox password, and Save.";
  }
  return "Email is not configured (set SMTP in Admin → Email Settings or SMTP_HOST/SMTP_USER/SMTP_PASS env).";
}

export async function getSmtpConfigurationStatus(): Promise<SmtpConfigurationStatus> {
  const envHost = process.env.SMTP_HOST?.trim();
  const fromEnv = resolveSmtpConfigFromEnv();
  const fromDb = await resolveSmtpConfigFromDb();
  const envOverridesDatabase = Boolean(envHost && fromDb);

  const active = fromEnv ?? fromDb;
  if (active) {
    return {
      configured: true,
      source: fromEnv ? "env" : "database",
      envOverridesDatabase,
      host: active.host,
      port: active.port,
      from: active.from,
      hasUsername: Boolean(active.auth?.user),
      hasPassword: Boolean(active.auth?.pass),
    };
  }

  return {
    configured: false,
    source: "none",
    envOverridesDatabase,
    hasUsername: false,
    hasPassword: false,
    issue: await describeUnconfiguredSmtp(),
  };
}

function getTransport(config: SmtpConfig): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  const key = transportCacheKey(config);
  if (cachedTransport?.key === key) return cachedTransport.transport;

  const transport = nodemailer.createTransport(smtpTransportOptions(config));

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
      error: await describeUnconfiguredSmtp(),
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
