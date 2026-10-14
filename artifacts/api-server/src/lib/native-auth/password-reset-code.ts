import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { db, authCredentialsTable, authPasswordResetCodesTable } from "@workspace/db";
import { authEmailCodeTemplate } from "../email-templates.js";
import { sendEmail } from "../email.js";
import { isClerkDevTestEmail } from "../admin-auth.js";
import { CLERK_DEV_TEST_EMAIL_CODE } from "./email-code.js";

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export function generatePasswordResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashPasswordResetCode(code: string): string {
  const normalized = code.replace(/\D/g, "").trim();
  return createHash("sha256").update(`password-reset:${normalized}`).digest("hex");
}

function codesEqual(storedHash: string, code: string): boolean {
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashPasswordResetCode(code), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAcceptedDevResetCode(email: string, code: string): boolean {
  if (!isClerkDevTestEmail(email)) return false;
  return code.replace(/\D/g, "").trim() === CLERK_DEV_TEST_EMAIL_CODE;
}

export async function issueAndSendPasswordResetCode(params: {
  userId: string;
  email: string;
  platformName?: string;
  appPublicBaseUrl: string;
}): Promise<{ sent: boolean; devResetCode?: string; resetUrl?: string; error?: string; rateLimited?: boolean }> {
  const email = params.email.trim().toLowerCase();
  const [existing] = await db
    .select({ createdAt: authPasswordResetCodesTable.createdAt })
    .from(authPasswordResetCodesTable)
    .where(eq(authPasswordResetCodesTable.userId, params.userId))
    .limit(1);
  if (existing?.createdAt && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { sent: false, rateLimited: true };
  }

  const plainCode = generatePasswordResetCode();
  const codeHash = hashPasswordResetCode(plainCode);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.delete(authPasswordResetCodesTable).where(eq(authPasswordResetCodesTable.userId, params.userId));
  await db.insert(authPasswordResetCodesTable).values({
    userId: params.userId,
    email,
    codeHash,
    expiresAt,
  });

  const appName = params.platformName?.trim() || "Seller Lens";
  const resetUrl = `${params.appPublicBaseUrl.replace(/\/$/, "")}/reset-password?email=${encodeURIComponent(email)}&code=${plainCode}`;
  const html = authEmailCodeTemplate({
    platformName: appName,
    code: plainCode,
    expiresMinutes: 15,
    headline: "Password reset code",
    intro: `Use this code to reset your password for <strong>${appName}</strong>.`,
    ctaUrl: resetUrl,
    ctaLabel: "Enter code on reset page",
  });

  let sent = false;
  let sendError: string | undefined;
  if (!isClerkDevTestEmail(email)) {
    const result = await sendEmail({
      to: email,
      subject: `${plainCode} is your ${appName} password reset code`,
      html,
    });
    sent = result.success;
    sendError = result.error;
  }

  const includeDevCode = process.env.NODE_ENV !== "production";
  if (includeDevCode) {
    return {
      sent: sent || isClerkDevTestEmail(email),
      devResetCode: plainCode,
      resetUrl,
      error: sendError,
    };
  }
  if (!sent && !isClerkDevTestEmail(email)) {
    return { sent: false, error: sendError ?? "Could not send reset email" };
  }
  return { sent: true, resetUrl };
}

export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.replace(/\D/g, "").trim();
  if (trimmedCode.length !== 6) {
    return { ok: false, error: "Enter the 6-digit reset code" };
  }

  if (isAcceptedDevResetCode(normalizedEmail, trimmedCode)) {
    const [cred] = await db
      .select({ userId: authCredentialsTable.userId })
      .from(authCredentialsTable)
      .where(eq(authCredentialsTable.email, normalizedEmail))
      .limit(1);
    if (!cred) return { ok: false, error: "Invalid reset code" };
    return { ok: true, userId: cred.userId };
  }

  const now = new Date();
  const [row] = await db
    .select()
    .from(authPasswordResetCodesTable)
    .where(and(eq(authPasswordResetCodesTable.email, normalizedEmail), gt(authPasswordResetCodesTable.expiresAt, now)))
    .limit(1);
  if (!row || !codesEqual(row.codeHash, trimmedCode)) {
    return { ok: false, error: "Invalid or expired reset code" };
  }
  return { ok: true, userId: row.userId };
}

export async function clearPasswordResetCode(userId: string): Promise<void> {
  await db.delete(authPasswordResetCodesTable).where(eq(authPasswordResetCodesTable.userId, userId));
}
