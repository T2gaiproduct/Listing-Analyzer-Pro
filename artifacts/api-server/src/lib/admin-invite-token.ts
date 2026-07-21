import crypto from "crypto";

export function generateAdminInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildAdminInviteUrl(token: string, appBaseUrl?: string): string {
  const base = (appBaseUrl ?? process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://listingauditor.com").replace(/\/$/, "");
  return `${base}/accept-admin-invite?token=${token}`;
}
