import { getConfiguredAppUrl } from "./app-base-url.js";

const PLATFORM_NAME = "Ecommerce Guru";
/** Site theme orange — used for CTAs, labels, and accents in all transactional email. */
export const EMAIL_ACCENT_ORANGE = "#f97316";
const ACCENT_ORANGE = EMAIL_ACCENT_ORANGE;
const HIGHLIGHT_BOX_BG = "#fff7ed";
const HIGHLIGHT_BOX_BORDER = "#fed7aa";
const TEXT_MUTED = "#64748b";
const TEXT_BODY = "#475569";
const TEXT_DARK = "#0f172a";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolvePublicSiteOrigin(): string {
  const configured = getConfiguredAppUrl()?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return "https://sellerlens.io";
}

/** Absolute URL for the site logo (Admin → Platform Settings or /logo.png). */
export function resolveEmailLogoUrl(): string {
  return `${resolvePublicSiteOrigin()}/logo.png`;
}

function normalizeOtpCode(code: string): string {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  return digits.padStart(6, "0");
}

export function buildOtpDigitBoxesHtml(code: string): string {
  const digits = normalizeOtpCode(code).split("");
  const cells = digits
    .map((digit) => {
      const char = digit.trim() ? escapeHtml(digit) : "&nbsp;";
      return `<td style="width:44px;height:52px;border:1px solid #e2e8f0;border-radius:10px;text-align:center;vertical-align:middle;font-size:26px;font-weight:700;color:${ACCENT_ORANGE};font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#ffffff;">${char}</td>`;
    })
    .join('<td style="width:8px;"></td>');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 20px;"><tr>${cells}</tr></table>`;
}

function emailSocialFooterHtml(): string {
  const site = escapeHtml(resolvePublicSiteOrigin());
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px;">
    <tr>
      <td style="padding:0 6px;"><a href="${site}" style="text-decoration:none;color:#9ca3af;font-size:11px;">Website</a></td>
      <td style="padding:0 6px;color:#6b7280;">·</td>
      <td style="padding:0 6px;"><a href="${site}/help" style="text-decoration:none;color:#9ca3af;font-size:11px;">Help</a></td>
    </tr>
  </table>`;
}

function welcomeHeroSvgHtml(): string {
  return `<div style="text-align:center;margin:8px 0 24px;">
  <svg width="200" height="120" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="">
    <rect x="58" y="18" width="84" height="84" rx="16" fill="#ffedd5"/>
    <rect x="72" y="32" width="56" height="72" rx="10" fill="#ffffff" stroke="#fed7aa" stroke-width="2"/>
    <rect x="80" y="48" width="40" height="8" rx="4" fill="#fb923c"/>
    <rect x="80" y="62" width="28" height="6" rx="3" fill="#e5e7eb"/>
    <circle cx="130" cy="28" r="14" fill="#bfdbfe"/>
    <path d="M118 88 Q140 72 158 88" stroke="#86efac" stroke-width="8" fill="none" stroke-linecap="round"/>
  </svg>
</div>`;
}

function logoHeaderRowHtml(): string {
  const logoUrl = escapeHtml(resolveEmailLogoUrl());
  const name = escapeHtml(PLATFORM_NAME);
  return `<tr>
    <td align="center" style="padding:32px 24px 16px;">
      <img src="${logoUrl}" alt="${name}" width="160" height="auto" style="display:block;max-width:160px;height:auto;border:0;" />
    </td>
  </tr>`;
}

export type OtpEmailLayoutInput = {
  headline: string;
  subtitle: string;
  code: string;
  expiresMinutes: number;
  footerNote?: string;
  ctaUrl?: string;
  ctaLabel?: string;
};

/** Shootmail-style OTP email (verification codes, password reset codes). */
export function otpEmailLayout(input: OtpEmailLayoutInput): string {
  const headline = escapeHtml(input.headline);
  const subtitle = escapeHtml(input.subtitle);
  const expires = Math.max(1, Math.floor(input.expiresMinutes));
  const footerNote = input.footerNote
    ? `<p style="margin:16px 0 0;font-size:13px;color:${TEXT_MUTED};line-height:1.5;">${escapeHtml(input.footerNote)}</p>`
    : "";
  const ctaHtml =
    input.ctaUrl && input.ctaLabel
      ? `<p style="margin:20px 0 0;text-align:center;"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:${ACCENT_ORANGE};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:600;font-size:14px;">${escapeHtml(input.ctaLabel)}</a></p>`
      : "";
  const digitBoxes = buildOtpDigitBoxesHtml(input.code);
  const site = escapeHtml(resolvePublicSiteOrigin());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;box-shadow:0 8px 32px rgba(15,23,42,0.08);overflow:hidden;">
          ${logoHeaderRowHtml()}
          <tr><td style="padding:0 32px 8px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:700;color:${TEXT_DARK};">${headline}</h1>
            <p style="margin:10px 0 0;font-size:14px;color:${TEXT_MUTED};">${subtitle}</p>
          </td></tr>
          <tr><td style="padding:0 32px 8px;text-align:center;">
            ${digitBoxes}
            <p style="margin:0;font-size:13px;color:${TEXT_BODY};line-height:1.6;">This OTP is valid for <strong>${expires} minutes</strong>. Please do not share this code with anyone.</p>
            ${footerNote}
            ${ctaHtml}
            <p style="margin:24px 0 0;font-size:13px;color:${TEXT_MUTED};">Questions? Visit <a href="${site}/help" style="color:${ACCENT_ORANGE};text-decoration:none;">Help Center</a> or reply to this email.</p>
          </td></tr>
          <tr><td style="padding:28px 32px 32px;text-align:center;border-top:1px solid #f1f5f9;">
            ${emailSocialFooterHtml()}
            <p style="margin:0;font-size:12px;color:#94a3b8;">${escapeHtml(PLATFORM_NAME)}</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type ModernEmailLayoutInput = {
  title: string;
  greetingHtml?: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  showHero?: boolean;
  highlightHtml?: string;
};

/** Modern welcome-style layout for invites, alerts, and other non-OTP mail. */
export function modernNotificationEmailLayout(input: ModernEmailLayoutInput): string {
  const title = escapeHtml(input.title);
  const greeting = input.greetingHtml ?? "";
  const hero = input.showHero !== false ? welcomeHeroSvgHtml() : "";
  const highlight = input.highlightHtml
    ? `<div style="background:${HIGHLIGHT_BOX_BG};border:1px solid ${HIGHLIGHT_BOX_BORDER};border-radius:14px;padding:18px 20px;margin:20px 0;text-align:left;">${input.highlightHtml}</div>`
    : "";
  const ctaHtml =
    input.ctaUrl && input.ctaLabel
      ? `<p style="margin:28px 0 8px;text-align:center;"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:${ACCENT_ORANGE};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:999px;font-weight:700;font-size:15px;letter-spacing:0.02em;">${escapeHtml(input.ctaLabel)}</a></p>`
      : "";
  const site = escapeHtml(resolvePublicSiteOrigin());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06);">
          ${logoHeaderRowHtml()}
          <tr><td style="padding:8px 36px 32px;text-align:center;">
            ${hero}
            <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:${TEXT_DARK};line-height:1.25;">${title}</h1>
            ${greeting ? `<p style="margin:0 0 16px;font-size:16px;color:${TEXT_BODY};line-height:1.65;text-align:left;">${greeting}</p>` : ""}
            <div style="font-size:15px;color:${TEXT_BODY};line-height:1.65;text-align:left;">${input.bodyHtml}</div>
            ${highlight}
            ${ctaHtml}
            <p style="margin:24px 0 0;font-size:13px;color:${TEXT_MUTED};text-align:center;line-height:1.5;">You're receiving this because you use ${escapeHtml(PLATFORM_NAME)}.<br><a href="${site}" style="color:${ACCENT_ORANGE};text-decoration:none;">${site.replace(/^https?:\/\//, "")}</a></p>
          </td></tr>
          <tr><td style="background:#374151;padding:28px 24px;text-align:center;">
            ${emailSocialFooterHtml()}
            <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">${escapeHtml(PLATFORM_NAME)} · Marketplace listing tools</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
