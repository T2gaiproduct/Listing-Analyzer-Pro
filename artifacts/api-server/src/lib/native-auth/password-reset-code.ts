import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { eq, and, or, sql } from "drizzle-orm";
import { db, authCredentialsTable, authPasswordResetCodesTable } from "@workspace/db";
import { authEmailCodeTemplate } from "../email-templates.js";
import { sendEmail } from "../email.js";
import { isClerkDevTestEmail } from "../admin-auth.js";
import { CLERK_DEV_TEST_EMAIL_CODE } from "./email-code.js";
import { ensureNativeAuthSchemaMigrated } from "../ensure-native-auth-schema.js";
import {
  findAuthCredentialByEmail,
  normalizeAuthEmail,
  syncAuthCredentialEmail,
} from "./credential-email.js";
import { normalizeSixDigitCode } from "./auth-code.js";

const CODE_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export function generatePasswordResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashPasswordResetCode(code: string): string {
  const normalized = code.replace(/\D/g, "").trim();
  return createHash("sha256").update(`password-reset:${normalized}`).digest("hex");
}

function normalizeStoredCodeHash(storedHash: string): string | null {
  const normalized = storedHash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) return null;
  return normalized;
}

function codesEqual(storedHash: string, code: string): boolean {
  const stored = normalizeStoredCodeHash(storedHash);
  if (!stored) return false;
  const expected = hashPasswordResetCode(code);
  if (stored.length !== expected.length) return false;
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(expected, "hex");
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
  await ensureNativeAuthSchemaMigrated();
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

  await syncAuthCredentialEmail(params.userId, email);
  await db.delete(authPasswordResetCodesTable).where(eq(authPasswordResetCodesTable.userId, params.userId));
  await db.insert(authPasswordResetCodesTable).values({
    userId: params.userId,
    email,
    codeHash,
    expiresAt,
  });

  const appName = params.platformName?.trim() || "Ecommerce Guru";
  const resetUrl = `${params.appPublicBaseUrl.replace(/\/$/, "")}/reset-password?email=${encodeURIComponent(email)}&code=${plainCode}`;
  const html = authEmailCodeTemplate({
    platformName: appName,
    code: plainCode,
    expiresMinutes: 60,
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

const resetCodeNotExpired = sql`${authPasswordResetCodesTable.expiresAt} > now()`;

export async function verifyPasswordResetCode(
  email: string,
  code: unknown,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  await ensureNativeAuthSchemaMigrated();
  const normalizedEmail = normalizeAuthEmail(email);
  const trimmedCode = normalizeSixDigitCode(code);
  if (trimmedCode.length !== 6) {
    return { ok: false, error: "Enter the 6-digit reset code" };
  }

  const cred = await findAuthCredentialByEmail(normalizedEmail);

  if (isAcceptedDevResetCode(normalizedEmail, trimmedCode)) {
    if (!cred) return { ok: false, error: "Invalid reset code" };
    return { ok: true, userId: cred.userId };
  }

  const codeHash = hashPasswordResetCode(trimmedCode);

  // Primary: match exact code hash (avoids JS/PG clock skew on expiry).
  const [byHash] = await db
    .select({
      userId: authPasswordResetCodesTable.userId,
      email: authPasswordResetCodesTable.email,
      codeHash: authPasswordResetCodesTable.codeHash,
    })
    .from(authPasswordResetCodesTable)
    .where(and(eq(authPasswordResetCodesTable.codeHash, codeHash), resetCodeNotExpired))
    .limit(1);

  if (byHash) {
    const rowEmail = normalizeAuthEmail(byHash.email);
    const emailOk = rowEmail === normalizedEmail;
    const userOk = cred != null && cred.userId === byHash.userId;
    if (emailOk || userOk) {
      return { ok: true, userId: byHash.userId };
    }
    return { ok: false, error: "That reset code is not for this email address" };
  }

  // Fallback: active code for this account (user may have mistyped one digit).
  const accountScope = cred
    ? or(
        eq(authPasswordResetCodesTable.userId, cred.userId),
        sql`lower(${authPasswordResetCodesTable.email}) = ${normalizedEmail}`,
      )
    : sql`lower(${authPasswordResetCodesTable.email}) = ${normalizedEmail}`;

  const [activeForAccount] = await db
    .select({
      userId: authPasswordResetCodesTable.userId,
      codeHash: authPasswordResetCodesTable.codeHash,
      expiresAt: authPasswordResetCodesTable.expiresAt,
    })
    .from(authPasswordResetCodesTable)
    .where(and(accountScope, resetCodeNotExpired))
    .limit(1);

  if (activeForAccount && codesEqual(activeForAccount.codeHash, trimmedCode)) {
    return { ok: true, userId: activeForAccount.userId };
  }

  const [expiredForAccount] = await db
    .select({ expiresAt: authPasswordResetCodesTable.expiresAt })
    .from(authPasswordResetCodesTable)
    .where(accountScope)
    .limit(1);

  if (expiredForAccount && expiredForAccount.expiresAt <= new Date()) {
    return { ok: false, error: "Reset code expired — request a new code" };
  }

  if (!activeForAccount && !expiredForAccount) {
    return { ok: false, error: "No reset code found — use Send reset code first" };
  }

  return { ok: false, error: "Incorrect reset code — check the latest email" };
}

export async function clearPasswordResetCode(userId: string): Promise<void> {
  await db.delete(authPasswordResetCodesTable).where(eq(authPasswordResetCodesTable.userId, userId));
}
