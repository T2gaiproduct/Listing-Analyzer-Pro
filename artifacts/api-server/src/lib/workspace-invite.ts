import type { Request } from "express";
import { sendEmail } from "./email.js";
import { workspaceInviteEmailTemplate } from "./email-templates.js";
import { shouldSendTeamInviteEmailToAddress } from "./notification-preferences.js";

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
  return `${base}/accept-workspace-invite?token=${encodeURIComponent(token)}`;
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
