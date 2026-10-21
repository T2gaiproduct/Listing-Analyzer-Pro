import {
  EMAIL_ACCENT_ORANGE,
  escapeHtml,
  modernNotificationEmailLayout,
  otpEmailLayout,
  resolvePublicSiteOrigin,
} from "./email-template-layout.js";

const EMAIL_LABEL_ACCENT = EMAIL_ACCENT_ORANGE;

export function inviteEmailTemplate({
  inviterName,
  companyName,
  inviteUrl,
  role,
  invitedName,
}: {
  inviterName: string;
  companyName: string;
  inviteUrl: string;
  role: string;
  invitedName: string;
}): string {
  const roleDescriptions: Record<string, string> = {
    admin: "Full access — can manage team, billing, and all audits",
    editor: "Can create and edit audits, cannot manage billing or team",
    viewer: "Read-only access to audits and reports",
  };

  return modernNotificationEmailLayout({
    title: "You're invited to the team",
    greetingHtml: `Hi <strong>${escapeHtml(invitedName)}</strong>,`,
    bodyHtml: `<p style="margin:0 0 12px;"><strong>${escapeHtml(inviterName)}</strong> invited you to join <strong>${escapeHtml(companyName)}</strong> on Ecommerce Guru.</p>`,
    highlightHtml: `<p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${EMAIL_LABEL_ACCENT};">Your role: ${escapeHtml(role)}</p>
      <p style="margin:0;color:#475569;font-size:14px;line-height:1.5;">${escapeHtml(roleDescriptions[role] ?? "Team member access")}</p>`,
    ctaUrl: inviteUrl,
    ctaLabel: "Accept invitation",
  });
}

export function welcomeEmailTemplate({
  companyName,
  memberName,
  role,
}: {
  companyName: string;
  memberName: string;
  role: string;
}): string {
  const dashboardUrl = `${resolvePublicSiteOrigin()}/dashboard`;
  return modernNotificationEmailLayout({
    title: "Hey, welcome!",
    greetingHtml: `Hi <strong>${escapeHtml(memberName)}</strong>,`,
    bodyHtml: `<p style="margin:0 0 12px;">You have been added to <strong>${escapeHtml(companyName)}</strong>. Your role is <strong>${escapeHtml(role)}</strong> — you can open the workspace and start collaborating right away.</p>`,
    ctaUrl: dashboardUrl,
    ctaLabel: "Get started",
  });
}

export function workspaceInviteEmailTemplate({
  invitedName,
  workspaceName,
  roleName,
  inviterName,
  inviteUrl,
}: {
  invitedName: string;
  workspaceName: string;
  roleName: string;
  inviterName: string;
  inviteUrl: string;
}): string {
  return modernNotificationEmailLayout({
    title: "Join your workspace",
    greetingHtml: `Hi <strong>${escapeHtml(invitedName)}</strong>,`,
    bodyHtml: `<p style="margin:0 0 12px;"><strong>${escapeHtml(inviterName)}</strong> invited you to collaborate on Ecommerce Guru.</p>`,
    highlightHtml: `<p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${EMAIL_LABEL_ACCENT};">Workspace</p>
      <p style="margin:0 0 12px;font-size:17px;font-weight:700;color:#0f172a;">${escapeHtml(workspaceName)}</p>
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${EMAIL_LABEL_ACCENT};">Role</p>
      <p style="margin:0;color:#475569;font-size:14px;">${escapeHtml(roleName)}</p>`,
    ctaUrl: inviteUrl,
    ctaLabel: "Accept invitation",
  });
}

export function adminRoleAssignedEmailTemplate({
  recipientName,
  roleName,
  permissionLabels,
  adminSignInUrl,
  assignedByName,
  isUpdate,
}: {
  recipientName: string;
  roleName: string;
  permissionLabels: string[];
  adminSignInUrl: string;
  assignedByName: string;
  isUpdate?: boolean;
}): string {
  const permissionList = permissionLabels.length
    ? permissionLabels.map((label) => `<li style="margin:4px 0;">${escapeHtml(label)}</li>`).join("")
    : "<li style=\"margin:4px 0;\">Limited admin access (see your administrator for details)</li>";

  const title = isUpdate ? "Your admin role was updated" : "You've got admin access";
  const intro = isUpdate
    ? `<strong>${escapeHtml(assignedByName)}</strong> updated your admin role on Ecommerce Guru.`
    : `<strong>${escapeHtml(assignedByName)}</strong> assigned you an admin role on Ecommerce Guru.`;

  return modernNotificationEmailLayout({
    title,
    greetingHtml: `Hi <strong>${escapeHtml(recipientName)}</strong>,`,
    bodyHtml: `<p style="margin:0 0 12px;">${intro}</p>
      <p style="margin:0;">Sign in with this email address, then open the admin panel.</p>`,
    highlightHtml: `<p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${EMAIL_LABEL_ACCENT};">Role: ${escapeHtml(roleName)}</p>
      <ul style="margin:8px 0 0;padding-left:18px;color:#475569;font-size:14px;line-height:1.5;">${permissionList}</ul>`,
    ctaUrl: adminSignInUrl,
    ctaLabel: "Sign in to admin",
    showHero: false,
  });
}

export function adminRoleInviteEmailTemplate({
  roleName,
  permissionLabels,
  signUpUrl,
  assignedByName,
  invitedEmail,
}: {
  roleName: string;
  permissionLabels: string[];
  signUpUrl: string;
  assignedByName: string;
  invitedEmail: string;
}): string {
  const permissionList = permissionLabels.length
    ? permissionLabels.map((label) => `<li style="margin:4px 0;">${escapeHtml(label)}</li>`).join("")
    : "<li style=\"margin:4px 0;\">Limited admin access (see your administrator for details)</li>";

  return modernNotificationEmailLayout({
    title: "You're invited to admin",
    bodyHtml: `<p style="margin:0 0 12px;"><strong>${escapeHtml(assignedByName)}</strong> invited you to join Ecommerce Guru as an admin.</p>
      <p style="margin:0;">Create an account using <strong>${escapeHtml(invitedEmail)}</strong>.</p>`,
    highlightHtml: `<p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${EMAIL_LABEL_ACCENT};">Role: ${escapeHtml(roleName)}</p>
      <ul style="margin:8px 0 0;padding-left:18px;color:#475569;font-size:14px;line-height:1.5;">${permissionList}</ul>`,
    ctaUrl: signUpUrl,
    ctaLabel: "Accept invitation",
    showHero: false,
  });
}

export function notificationEmailTemplate({
  recipientName,
  title,
  message,
  actionUrl,
}: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl?: string;
}): string {
  return modernNotificationEmailLayout({
    title,
    greetingHtml: `Hi <strong>${escapeHtml(recipientName)}</strong>,`,
    bodyHtml: `<p style="margin:0;">${escapeHtml(message)}</p>`,
    ctaUrl: actionUrl,
    ctaLabel: actionUrl ? "View in Ecommerce Guru" : undefined,
  });
}

export function authPasswordResetTemplate({
  platformName,
  resetUrl,
  resetCode,
  expiresMinutes,
}: {
  platformName: string;
  resetUrl: string;
  resetCode: string;
  expiresMinutes: number;
}): string {
  const app = platformName.trim() || "Ecommerce Guru";
  return otpEmailLayout({
    headline: "Your one time password!",
    subtitle: `Your OTP for resetting your password on ${app}`,
    code: resetCode,
    expiresMinutes,
    ctaUrl: resetUrl,
    ctaLabel: "Reset password",
    footerNote: "You can also open Sign in → Forgot password and enter the code manually.",
  });
}

export function authEmailCodeTemplate({
  platformName,
  code,
  expiresMinutes,
  headline = "Verify your email",
  intro,
  ctaUrl,
  ctaLabel,
}: {
  platformName: string;
  code: string;
  expiresMinutes: number;
  headline?: string;
  intro?: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const app = platformName.trim() || "Ecommerce Guru";
  const isPasswordReset =
    headline.toLowerCase().includes("password")
    || intro?.toLowerCase().includes("reset");
  const subtitle = isPasswordReset
    ? `Your OTP for resetting your password on ${app}`
    : `Your OTP for signing in to ${app}`;

  return otpEmailLayout({
    headline: "Your one time password!",
    subtitle,
    code,
    expiresMinutes,
    ctaUrl,
    ctaLabel,
  });
}
