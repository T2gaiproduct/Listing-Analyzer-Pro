import { inArray } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { sendEmail } from "./email.js";
import { resolveEmailLogoUrl } from "./email-logo-url.js";
import { escapeHtml, modernNotificationEmailLayout } from "./email-template-layout.js";

const INBOX_SETTING_KEYS = ["support_email", "email_reply_to", "email_from_address"] as const;

function getAppBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://sellerlens.io").replace(/\/$/, "");
}

export async function resolveSupportInboxEmail(): Promise<string | null> {
  const rows = await db
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...INBOX_SETTING_KEYS]));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  for (const key of INBOX_SETTING_KEYS) {
    const trimmed = map[key]?.trim();
    if (trimmed && trimmed.includes("@")) return trimmed;
  }
  return null;
}

async function adminNotificationHtml(params: {
  ticketId: number;
  customerEmail: string;
  customerName?: string | null;
  subject: string;
  message: string;
  adminTicketsUrl: string;
}): Promise<string> {
  const logoUrl = await resolveEmailLogoUrl();
  const who = escapeHtml(params.customerName?.trim() || params.customerEmail);
  return modernNotificationEmailLayout({
    logoUrl,
    title: `New support ticket #${params.ticketId}`,
    bodyHtml: `<p style="margin:0 0 12px;color:#64748b;font-size:14px;">From <strong>${who}</strong> (${escapeHtml(params.customerEmail)})</p>
      <p style="margin:0 0 12px;font-weight:600;color:#0f172a;">${escapeHtml(params.subject)}</p>
      <div style="background:#f8fafc;border-radius:12px;padding:16px;color:#475569;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(params.message)}</div>`,
    ctaUrl: params.adminTicketsUrl,
    ctaLabel: "View in admin",
    showHero: false,
  });
}

async function customerConfirmationHtml(params: {
  customerName?: string | null;
  subject: string;
}): Promise<string> {
  const logoUrl = await resolveEmailLogoUrl();
  const greeting = params.customerName?.trim()
    ? `Hi ${escapeHtml(params.customerName.trim())},`
    : "Hi there,";

  return modernNotificationEmailLayout({
    logoUrl,
    title: "We received your request",
    greetingHtml: greeting,
    bodyHtml: `<p style="margin:0;">Thanks for contacting us about <strong>${escapeHtml(params.subject)}</strong>. Our team will reply within one business day.</p>`,
    showHero: true,
  });
}

async function replyHtml(params: {
  customerName?: string | null;
  replyMessage: string;
}): Promise<string> {
  const logoUrl = await resolveEmailLogoUrl();
  const greeting = params.customerName?.trim()
    ? `Hi ${escapeHtml(params.customerName.trim())},`
    : "Hi there,";

  return modernNotificationEmailLayout({
    logoUrl,
    title: "Update from support",
    greetingHtml: greeting,
    bodyHtml: `<div style="color:#334155;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(params.replyMessage)}</div>`,
    showHero: false,
  });
}

export async function sendSupportTicketCreatedEmails(params: {
  ticketId: number;
  email: string;
  name?: string | null;
  subject: string;
  message: string;
}): Promise<{ adminSent: boolean; customerSent: boolean; adminError?: string; customerError?: string }> {
  const inbox = await resolveSupportInboxEmail();
  const adminTicketsUrl = `${getAppBaseUrl()}/admin/help/support-tickets`;

  let adminSent = false;
  let customerSent = false;
  let adminError: string | undefined;
  let customerError: string | undefined;

  if (inbox) {
    const adminResult = await sendEmail({
      to: inbox,
      subject: `[Support #${params.ticketId}] ${params.subject}`,
      html: await adminNotificationHtml({
        ticketId: params.ticketId,
        customerEmail: params.email,
        customerName: params.name,
        subject: params.subject,
        message: params.message,
        adminTicketsUrl,
      }),
    });
    adminSent = adminResult.success;
    adminError = adminResult.error;
  } else {
    adminError = "No support inbox email configured (Admin → Settings → Platform → Support Email)";
  }

  const customerResult = await sendEmail({
    to: params.email,
    subject: `We received your request: ${params.subject}`,
    html: await customerConfirmationHtml({ customerName: params.name, subject: params.subject }),
  });
  customerSent = customerResult.success;
  customerError = customerResult.error;

  return { adminSent, customerSent, adminError, customerError };
}

export async function sendSupportTicketReplyEmail(params: {
  toEmail: string;
  customerName?: string | null;
  originalSubject: string;
  replyMessage: string;
}): Promise<{ success: boolean; error?: string }> {
  const subject = params.originalSubject.trim().toLowerCase().startsWith("re:")
    ? params.originalSubject.trim()
    : `Re: ${params.originalSubject.trim()}`;

  return sendEmail({
    to: params.toEmail,
    subject,
    html: await replyHtml({ customerName: params.customerName, replyMessage: params.replyMessage }),
  });
}

async function customerFollowUpHtml(params: {
  ticketId: number;
  customerEmail: string;
  customerName?: string | null;
  subject: string;
  message: string;
  adminTicketsUrl: string;
}): Promise<string> {
  const logoUrl = await resolveEmailLogoUrl();
  const who = escapeHtml(params.customerName?.trim() || params.customerEmail);
  return modernNotificationEmailLayout({
    logoUrl,
    title: `Customer reply on ticket #${params.ticketId}`,
    bodyHtml: `<p style="margin:0 0 12px;color:#64748b;font-size:14px;">From <strong>${who}</strong> (${escapeHtml(params.customerEmail)})</p>
      <p style="margin:0 0 12px;font-weight:600;color:#0f172a;">${escapeHtml(params.subject)}</p>
      <div style="background:#f8fafc;border-radius:12px;padding:16px;color:#475569;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(params.message)}</div>`,
    ctaUrl: params.adminTicketsUrl,
    ctaLabel: "View in admin",
    showHero: false,
  });
}

/** Notify the support inbox that the customer replied in-app (does not email the customer). */
export async function sendSupportTicketCustomerFollowUpEmail(params: {
  ticketId: number;
  customerEmail: string;
  customerName?: string | null;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const inbox = await resolveSupportInboxEmail();
  if (!inbox) {
    return {
      success: false,
      error: "No support inbox email configured (Admin → Settings → Platform → Support Email)",
    };
  }

  const adminTicketsUrl = `${getAppBaseUrl()}/admin/help/support-tickets`;
  const subject = params.subject.trim().toLowerCase().startsWith("re:")
    ? params.subject.trim()
    : `Re: ${params.subject.trim()}`;

  return sendEmail({
    to: inbox,
    subject: `[Support #${params.ticketId}] ${subject}`,
    html: await customerFollowUpHtml({
      ticketId: params.ticketId,
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      subject: params.subject,
      message: params.message,
      adminTicketsUrl,
    }),
  });
}
