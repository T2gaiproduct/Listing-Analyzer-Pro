import type { Request } from "express";
import { sendEmail } from "./email.js";
import { workspaceInviteEmailTemplate } from "./email-templates.js";
import { shouldSendTeamInviteEmailToAddress } from "./notification-preferences.js";
import { fetchClerkUserIdByEmail } from "./clerk-user.js";
import { createNotification } from "./notifications.js";

const DEFAULT_APP_URL = "https://listingauditor.com";

export function resolveAppBaseUrl(req?: Request): string {
  if (req) {
    const origin = req.get("origin");
    if (origin) return origin.replace(/\/$/, "");
    const referer = req.get("referer");
    if (referer) {
      try {
        return new URL(referer).origin;
      } catch {
        /* ignore */
      }
    }
  }
  return (process.env.APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "");
}

export function buildWorkspaceInviteUrl(token: string, appBaseUrl?: string): string {
  const base = (appBaseUrl ?? resolveAppBaseUrl()).replace(/\/$/, "");
  const basePath = (process.env.BASE_PATH ?? "/").replace(/\/$/, "");
  return `${base}${basePath}/accept-workspace-invite?token=${encodeURIComponent(token)}`;
}

export async function sendWorkspaceInviteEmail(opts: {
  toEmail: string;
  invitedName: string;
  workspaceName: string;
  roleName: string;
  inviterName: string;
  inviteUrl: string;
}): Promise<{ emailSent: boolean; emailError?: string }> {
  const shouldEmail = await shouldSendTeamInviteEmailToAddress(opts.toEmail);
  if (!shouldEmail) {
    return { emailSent: false, emailError: "Invitee has team notifications disabled" };
  }

  const html = workspaceInviteEmailTemplate({
    invitedName: opts.invitedName,
    workspaceName: opts.workspaceName,
    roleName: opts.roleName,
    inviterName: opts.inviterName,
    inviteUrl: opts.inviteUrl,
  });

  const result = await sendEmail({
    to: opts.toEmail,
    subject: `You've been invited to join ${opts.workspaceName} on SellerLens`,
    html,
  });

  return {
    emailSent: result.success,
    emailError: result.error,
  };
}

export async function deliverWorkspaceMemberInvite(opts: {
  invitedEmail: string;
  invitedName: string;
  workspaceName: string;
  roleName: string;
  inviterName: string;
  inviteToken: string;
  appBaseUrl?: string;
  req?: Request;
}): Promise<{ inviteUrl: string; emailSent: boolean; emailError?: string }> {
  const inviteUrl = buildWorkspaceInviteUrl(opts.inviteToken, opts.appBaseUrl ?? resolveAppBaseUrl(opts.req));

  let emailSent = false;
  let emailError: string | undefined;
  try {
    const emailResult = await sendWorkspaceInviteEmail({
      toEmail: opts.invitedEmail,
      invitedName: opts.invitedName,
      workspaceName: opts.workspaceName,
      roleName: opts.roleName,
      inviterName: opts.inviterName,
      inviteUrl,
    });
    emailSent = emailResult.emailSent;
    emailError = emailResult.emailError;
  } catch (emailErr) {
    emailError = emailErr instanceof Error ? emailErr.message : "Failed to send email";
  }

  try {
    const inviteeUserId = await fetchClerkUserIdByEmail(opts.invitedEmail);
    if (inviteeUserId) {
      void createNotification({
        userId: inviteeUserId,
        type: "team_invite",
        title: "Workspace invitation",
        message: `${opts.inviterName} invited you to join ${opts.workspaceName} as ${opts.roleName}.`,
        link: `/accept-workspace-invite?token=${opts.inviteToken}`,
      });
    }
  } catch {
    /* non-fatal */
  }

  return { inviteUrl, emailSent, emailError };
}
