import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { db, authCredentialsTable, authEmailVerificationCodesTable } from "@workspace/db";
import { authEmailCodeTemplate } from "../email-templates.js";
import { sendEmail } from "../email.js";
import { isClerkDevTestEmail } from "../admin-auth.js";

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
export const CLERK_DEV_TEST_EMAIL_CODE = "424242";

export function generateEmailVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashEmailVerificationCode(code: string): string {
  const normalized = code.replace(/\D/g, "").trim();
  return createHash("sha256").update(`email-code:${normalized}`).digest("hex");
}

function codesEqual(storedHash: string, code: string): boolean {
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashEmailVerificationCode(code), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAcceptedDevEmailCode(email: string, code: string): boolean {
  if (!isClerkDevTestEmail(email)) return false;
  return code.replace(/\D/g, "").trim() === CLERK_DEV_TEST_EMAIL_CODE;
}

export async function issueAndSendEmailVerificationCode(params: {
  userId: string;
  email: string;
  platformName?: string;
}): Promise<{ sent: boolean; devEmailCode?: string; error?: string; rateLimited?: boolean }> {
  const email = params.email.trim().toLowerCase();
  const [existing] = await db
    .select({ createdAt: authEmailVerificationCodesTable.createdAt })
    .from(authEmailVerificationCodesTable)
    .where(eq(authEmailVerificationCodesTable.userId, params.userId))
    .limit(1);
  if (existing?.createdAt && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { sent: false, rateLimited: true };
  }

  const plainCode = generateEmailVerificationCode();
  const codeHash = hashEmailVerificationCode(plainCode);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.delete(authEmailVerificationCodesTable).where(eq(authEmailVerificationCodesTable.userId, params.userId));
  await db.insert(authEmailVerificationCodesTable).values({
    userId: params.userId,
    email,
    codeHash,
    expiresAt,
  });

  const appName = params.platformName?.trim() || "Ecommerce Guru";
  const html = await authEmailCodeTemplate({
    platformName: appName,
    code: plainCode,
    expiresMinutes: 15,
  });

  let sent = false;
  let sendError: string | undefined;
  if (!isClerkDevTestEmail(email)) {
    const result = await sendEmail({
      to: email,
      subject: `${plainCode} is your ${appName} verification code`,
      html,
    });
    sent = result.success;
    sendError = result.error;
  }

  const includeDevCode = process.env.NODE_ENV !== "production";
  if (includeDevCode) {
    return { sent: sent || isClerkDevTestEmail(email), devEmailCode: plainCode, error: sendError };
  }
  if (!sent && !isClerkDevTestEmail(email)) {
    return { sent: false, error: sendError ?? "Could not send verification email" };
  }
  return { sent: true };
}

export async function verifyEmailVerificationCode(
  email: string,
  code: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.replace(/\D/g, "").trim();
  if (trimmedCode.length !== 6) {
    return { ok: false, error: "Enter the 6-digit verification code" };
  }

  if (isAcceptedDevEmailCode(normalizedEmail, trimmedCode)) {
    const [cred] = await db
      .select({ userId: authCredentialsTable.userId })
      .from(authCredentialsTable)
      .where(eq(authCredentialsTable.email, normalizedEmail))
      .limit(1);
    if (!cred) return { ok: false, error: "Invalid verification code" };
    return { ok: true, userId: cred.userId };
  }

  const now = new Date();
  const [row] = await db
    .select()
    .from(authEmailVerificationCodesTable)
    .where(
      and(eq(authEmailVerificationCodesTable.email, normalizedEmail), gt(authEmailVerificationCodesTable.expiresAt, now)),
    )
    .limit(1);
  if (!row || !codesEqual(row.codeHash, trimmedCode)) {
    return { ok: false, error: "Invalid or expired verification code" };
  }
  return { ok: true, userId: row.userId };
}

export async function clearEmailVerificationCode(userId: string): Promise<void> {
  await db.delete(authEmailVerificationCodesTable).where(eq(authEmailVerificationCodesTable.userId, userId));
}
