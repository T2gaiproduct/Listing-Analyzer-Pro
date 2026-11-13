import { sendEmail } from "./email.js";
import { resolveEmailLogoUrl } from "./email-logo-url.js";
import { escapeHtml, modernNotificationEmailLayout } from "./email-template-layout.js";
import { resolveSupportInboxEmail } from "./support-ticket-email.js";

function getAppBaseUrl(): string {
  return (process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://sellerlens.io").replace(/\/$/, "");
}

const FORM_LABELS: Record<string, string> = {
  newsletter: "Newsletter signup",
  contact: "General inquiry",
  enterprise: "Enterprise sales",
  demo: "Demo request",
};

function extraFieldsHtml(data: Record<string, string>): string {
  const skip = new Set(["message", "subject"]);
  const rows = Object.entries(data).filter(([k, v]) => !skip.has(k) && v.trim());
  if (rows.length === 0) return "";
  const lines = rows
    .map(([k, v]) => `<p style="margin:0 0 6px;color:#475569;font-size:14px;"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`)
    .join("");
  return `<div style="margin-top:12px;">${lines}</div>`;
}

async function inboxNotificationHtml(params: {
  formType: string;
  submissionId: number;
  email: string;
  name?: string | null;
  data: Record<string, string>;
  adminFormsUrl: string;
}): Promise<string> {
  const logoUrl = await resolveEmailLogoUrl();
  const label = FORM_LABELS[params.formType] ?? "Form submission";
  const who = escapeHtml(params.name?.trim() || params.email);
  const subject = params.data.subject?.trim();
  const message = params.data.message?.trim() ?? "";

  const bodyParts = [
    `<p style="margin:0 0 12px;color:#64748b;font-size:14px;">${label} · submission #${params.submissionId}</p>`,
    `<p style="margin:0 0 12px;color:#64748b;font-size:14px;">From <strong>${who}</strong> (${escapeHtml(params.email)})</p>`,
  ];
  if (subject) {
    bodyParts.push(`<p style="margin:0 0 12px;font-weight:600;color:#0f172a;">${escapeHtml(subject)}</p>`);
  }
  if (message) {
    bodyParts.push(
      `<div style="background:#f8fafc;border-radius:12px;padding:16px;color:#475569;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>`,
    );
  }
  bodyParts.push(extraFieldsHtml(params.data));

  return modernNotificationEmailLayout({
    logoUrl,
    title: `New ${label}`,
    bodyHtml: bodyParts.join(""),
    ctaUrl: params.adminFormsUrl,
    ctaLabel: "View in admin",
    showHero: false,
  });
}

async function customerConfirmationHtml(params: {
  customerName?: string | null;
  formLabel: string;
}): Promise<string> {
  const logoUrl = await resolveEmailLogoUrl();
  const greeting = params.customerName?.trim()
    ? `Hi ${escapeHtml(params.customerName.trim())},`
    : "Hi there,";

  return modernNotificationEmailLayout({
    logoUrl,
    title: "We received your message",
    greetingHtml: greeting,
    bodyHtml: `<p style="margin:0;">Thanks for reaching out (${escapeHtml(params.formLabel)}). Our team will get back to you within one business day.</p>`,
    showHero: true,
  });
}

export async function sendFormSubmissionNotificationEmails(params: {
  submissionId: number;
  formType: string;
  email: string;
  name?: string | null;
  data: Record<string, string>;
  sendCustomerConfirmation?: boolean;
}): Promise<{ inboxSent: boolean; customerSent: boolean; inboxError?: string; customerError?: string }> {
  const inbox = await resolveSupportInboxEmail();
  const label = FORM_LABELS[params.formType] ?? "Form submission";
  const adminFormsUrl = `${getAppBaseUrl()}/admin/marketing/forms?type=${encodeURIComponent(params.formType)}`;

  let inboxSent = false;
  let customerSent = false;
  let inboxError: string | undefined;
  let customerError: string | undefined;

  if (inbox) {
    const subjectLine = params.data.subject?.trim()
      ? `[${label}] ${params.data.subject.trim()}`
      : `[${label}] ${params.email}`;
    const inboxResult = await sendEmail({
      to: inbox,
      subject: subjectLine,
      html: await inboxNotificationHtml({
        formType: params.formType,
        submissionId: params.submissionId,
        email: params.email,
        name: params.name,
        data: params.data,
        adminFormsUrl,
      }),
    });
    inboxSent = inboxResult.success;
    inboxError = inboxResult.error;
  } else {
    inboxError = "No support inbox email configured (Admin → Company Settings → Support Email)";
  }

  if (params.sendCustomerConfirmation) {
    const customerResult = await sendEmail({
      to: params.email,
      subject: `We received your message — ${label}`,
      html: await customerConfirmationHtml({ customerName: params.name, formLabel: label }),
    });
    customerSent = customerResult.success;
    customerError = customerResult.error;
  }

  return { inboxSent, customerSent, inboxError, customerError };
}
