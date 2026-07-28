import { inArray } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { sendEmail } from "./email.js";

const INBOX_SETTING_KEYS = ["support_email", "email_reply_to", "email_from_address"] as const;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getAppBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://listingauditor.com").replace(/\/$/, "");
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

function adminNotificationHtml(params: {
  ticketId: number;
  customerEmail: string;
  customerName?: string | null;
  subject: string;
  message: string;
  adminTicketsUrl: string;
}): string {
  const who = escapeHtml(params.customerName?.trim() || params.customerEmail);
  return `<!DOCTYPE html>
<html lang="en"><body style="font-family:Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
<h2 style="color:#0f172a;margin:0 0 8px;">New support ticket #${params.ticketId}</h2>
<p style="color:#64748b;font-size:14px;margin:0 0 20px;">From <strong>${who}</strong> (${escapeHtml(params.customerEmail)})</p>
<p style="color:#0f172a;font-weight:600;margin:0 0 8px;">${escapeHtml(params.subject)}</p>
<div style="background:#f8fafc;border-radius:8px;padding:16px;color:#475569;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(params.message)}</div>
<p style="margin:24px 0 0;text-align:center;">
<a href="${params.adminTicketsUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">View in admin</a>
</p>
</div></body></html>`;
}

function customerConfirmationHtml(params: {
  customerName?: string | null;
  subject: string;
}): string {
  const greeting = params.customerName?.trim()
    ? `Hi ${escapeHtml(params.customerName.trim())},`
    : "Hi there,";

  return `<!DOCTYPE html>
<html lang="en"><body style="font-family:Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
<h2 style="color:#0f172a;margin:0 0 12px;">We received your support request</h2>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">${greeting}</p>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">Thanks for contacting us about <strong>${escapeHtml(params.subject)}</strong>. Our team will reply within one business day.</p>
<p style="color:#94a3b8;font-size:13px;margin:0;">SellerLens Support</p>
</div></body></html>`;
}

function replyHtml(params: {
  customerName?: string | null;
  replyMessage: string;
}): string {
  const greeting = params.customerName?.trim()
    ? `Hi ${escapeHtml(params.customerName.trim())},`
    : "Hi there,";

  return `<!DOCTYPE html>
<html lang="en"><body style="font-family:Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
<p style="color:#475569;font-size:15px;margin:0 0 16px;">${greeting}</p>
<div style="color:#334155;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(params.replyMessage)}</div>
<p style="color:#94a3b8;font-size:13px;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">SellerLens Support</p>
</div></body></html>`;
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
      html: adminNotificationHtml({
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
    html: customerConfirmationHtml({ customerName: params.name, subject: params.subject }),
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
    html: replyHtml({ customerName: params.customerName, replyMessage: params.replyMessage }),
  });
}
