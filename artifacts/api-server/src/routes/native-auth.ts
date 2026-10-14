import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gt } from "drizzle-orm";
import {
  db,
  authCredentialsTable,
  authOauthIdentitiesTable,
  authPasswordResetTokensTable,
} from "@workspace/db";
import { parseEmailForApi } from "@workspace/email-validation";
import { isNativeAuthEnabled, googleOAuthConfig } from "../lib/native-auth/config.js";
import { hashPassword, verifyPassword, hashResetTokenStable } from "../lib/native-auth/password.js";
import {
  createSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  signOAuthState,
  verifyOAuthState,
  newUserId,
  readSessionCookie,
} from "../lib/native-auth/session.js";
import { getRequestUserId } from "../lib/request-auth.js";
import { upsertUserProfile } from "../lib/user-profile.js";
import {
  issueAndSendEmailVerificationCode,
  verifyEmailVerificationCode,
  clearEmailVerificationCode,
} from "../lib/native-auth/email-code.js";
import {
  issueAndSendPasswordResetCode,
  verifyPasswordResetCode,
  clearPasswordResetCode,
} from "../lib/native-auth/password-reset-code.js";

const router: IRouter = Router();

const APP_DISPLAY_NAME = process.env.APP_DISPLAY_NAME ?? "Seller Lens";

/** Public browser URL for links in email (must match where users open the app). */
function appPublicBaseUrl(): string {
  const publicUrl = process.env.PUBLIC_APP_URL?.trim();
  if (publicUrl) return publicUrl.replace(/\/$/, "");
  return (process.env.APP_URL ?? "https://sellerlens.io").replace(/\/$/, "");
}

async function startEmailVerificationFlow(
  res: Response,
  params: { userId: string; email: string; status?: number },
): Promise<void> {
  const send = await issueAndSendEmailVerificationCode({
    userId: params.userId,
    email: params.email,
    platformName: APP_DISPLAY_NAME,
  });
  if (send.rateLimited) {
    res.status(429).json({ error: "Please wait before requesting another code" });
    return;
  }
  if (!send.sent && send.error && process.env.NODE_ENV === "production") {
    res.status(503).json({ error: send.error });
    return;
  }
  const payload: Record<string, unknown> = {
    needsEmailVerification: true,
    email: params.email,
  };
  if (send.devEmailCode) payload.devEmailCode = send.devEmailCode;
  res.status(params.status ?? 200).json(payload);
}

function nativeDisabled(_req: Request, res: Response): boolean {
  if (!isNativeAuthEnabled()) {
    res.status(404).json({ error: "Not found" });
    return true;
  }
  return false;
}

router.get("/auth/config", (_req, res) => {
  const google = googleOAuthConfig();
  res.json({
    enabled: isNativeAuthEnabled(),
    googleOAuth: google ? { clientId: google.clientId, redirectPath: "/api/auth/google/callback" } : null,
  });
});

router.get("/auth/session", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const userId = getRequestUserId(req);
  if (!userId) {
    res.json({ signedIn: false });
    return;
  }
  const [cred] = await db
    .select({ email: authCredentialsTable.email, emailVerified: authCredentialsTable.emailVerified })
    .from(authCredentialsTable)
    .where(eq(authCredentialsTable.userId, userId))
    .limit(1);
  res.json({
    signedIn: true,
    userId,
    email: cred?.email ?? null,
    emailVerified: cred?.emailVerified === 1,
    authSource: cred ? "native" : "clerk",
  });
});

router.post("/auth/logout", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const sessionId = readSessionCookie(req);
  if (sessionId) await deleteSession(sessionId);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.post("/auth/login", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const body = req.body as { email?: string; password?: string };
  const parsed = parseEmailForApi(body.email ?? "");
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const email = parsed.email;
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const [cred] = await db
    .select()
    .from(authCredentialsTable)
    .where(eq(authCredentialsTable.email, email))
    .limit(1);
  if (!cred?.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const valid = await verifyPassword(password, cred.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (cred.emailVerified !== 1) {
    await startEmailVerificationFlow(res, { userId: cred.userId, email: cred.email });
    return;
  }

  const { sessionId, expiresAt } = await createSession(cred.userId);
  setSessionCookie(res, sessionId, expiresAt);
  res.json({ userId: cred.userId, email: cred.email, token: sessionId });
});

router.get("/auth/register", (_req, res) => {
  res.status(405).json({
    error: "Use POST /api/auth/register with JSON body { email, password }.",
  });
});

router.post("/auth/register", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const body = req.body as { email?: string; password?: string; fullName?: string };
  const parsed = parseEmailForApi(body.email ?? "");
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const email = parsed.email;
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [existing] = await db
    .select({ userId: authCredentialsTable.userId, emailVerified: authCredentialsTable.emailVerified })
    .from(authCredentialsTable)
    .where(eq(authCredentialsTable.email, email))
    .limit(1);
  if (existing?.emailVerified === 1) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  let userId = existing?.userId;
  if (userId) {
    await db
      .update(authCredentialsTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(authCredentialsTable.userId, userId));
  } else {
    userId = newUserId();
    await db.insert(authCredentialsTable).values({
      userId,
      email,
      emailVerified: 0,
      passwordHash,
    });
    await upsertUserProfile(userId, {
      fullName: typeof body.fullName === "string" ? body.fullName.trim() || undefined : undefined,
      loginEmail: email,
    });
  }

  await startEmailVerificationFlow(res, { userId, email, status: 201 });
});

router.post("/auth/verify-email-code", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const body = req.body as { email?: string; code?: string };
  const parsed = parseEmailForApi(body.email ?? "");
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const code = typeof body.code === "string" ? body.code : "";
  const verified = await verifyEmailVerificationCode(parsed.email, code);
  if (!verified.ok) {
    res.status(400).json({ error: verified.error });
    return;
  }

  const [cred] = await db
    .select({ email: authCredentialsTable.email, emailVerified: authCredentialsTable.emailVerified })
    .from(authCredentialsTable)
    .where(eq(authCredentialsTable.userId, verified.userId))
    .limit(1);
  if (!cred) {
    res.status(400).json({ error: "Invalid verification code" });
    return;
  }

  if (cred.emailVerified !== 1) {
    await db
      .update(authCredentialsTable)
      .set({ emailVerified: 1, updatedAt: new Date() })
      .where(eq(authCredentialsTable.userId, verified.userId));
  }
  await clearEmailVerificationCode(verified.userId);

  const { sessionId, expiresAt } = await createSession(verified.userId);
  setSessionCookie(res, sessionId, expiresAt);
  res.json({ userId: verified.userId, email: cred.email, token: sessionId });
});

router.post("/auth/resend-email-code", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const body = req.body as { email?: string };
  const parsed = parseEmailForApi(body.email ?? "");
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [cred] = await db
    .select({ userId: authCredentialsTable.userId, emailVerified: authCredentialsTable.emailVerified })
    .from(authCredentialsTable)
    .where(eq(authCredentialsTable.email, parsed.email))
    .limit(1);
  if (!cred || cred.emailVerified === 1) {
    res.json({ ok: true });
    return;
  }
  await startEmailVerificationFlow(res, { userId: cred.userId, email: parsed.email });
});

router.post("/auth/forgot-password", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const body = req.body as { email?: string };
  const parsed = parseEmailForApi(body.email ?? "");
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const email = parsed.email;
  const [cred] = await db
    .select({ userId: authCredentialsTable.userId })
    .from(authCredentialsTable)
    .where(eq(authCredentialsTable.email, email))
    .limit(1);

  // Always respond OK to avoid email enumeration.
  if (cred) {
    const send = await issueAndSendPasswordResetCode({
      userId: cred.userId,
      email,
      platformName: APP_DISPLAY_NAME,
      appPublicBaseUrl: appPublicBaseUrl(),
    });
    if (send.rateLimited) {
      res.status(429).json({ error: "Please wait before requesting another code" });
      return;
    }
    const payload: Record<string, unknown> = { ok: true };
    if (send.resetUrl) payload.resetUrl = send.resetUrl;
    if (process.env.NODE_ENV !== "production") {
      if (send.devResetCode) payload.devResetCode = send.devResetCode;
      if (send.error) payload.emailError = send.error;
    }
    res.json(payload);
    return;
  }
  res.json({ ok: true });
});

router.post("/auth/reset-password", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const body = req.body as { email?: string; code?: string; token?: string; password?: string };
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const rawToken = typeof body.token === "string" ? body.token.trim() : "";
  const rawCode = typeof body.code === "string" ? body.code.trim() : rawToken;
  const parsedEmail = parseEmailForApi(body.email ?? "");

  let userId: string | null = null;

  if (!("error" in parsedEmail) && rawCode.replace(/\D/g, "").length === 6) {
    const verified = await verifyPasswordResetCode(parsedEmail.email, rawCode);
    if (!verified.ok) {
      res.status(400).json({ error: verified.error });
      return;
    }
    userId = verified.userId;
  } else if (rawToken.length > 20) {
    const tokenHash = hashResetTokenStable(rawToken);
    const now = new Date();
    const [row] = await db
      .select()
      .from(authPasswordResetTokensTable)
      .where(and(eq(authPasswordResetTokensTable.tokenHash, tokenHash), gt(authPasswordResetTokensTable.expiresAt, now)))
      .limit(1);
    if (!row) {
      res.status(400).json({ error: "Reset link expired or invalid" });
      return;
    }
    userId = row.userId;
    await db.delete(authPasswordResetTokensTable).where(eq(authPasswordResetTokensTable.tokenHash, tokenHash));
  } else {
    res.status(400).json({ error: "Enter your email and the 6-digit reset code" });
    return;
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(authCredentialsTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(authCredentialsTable.userId, userId));
  await clearPasswordResetCode(userId);
  res.json({ ok: true });
});

router.get("/auth/google/start", (req, res) => {
  if (nativeDisabled(req, res)) return;
  const google = googleOAuthConfig();
  if (!google) {
    res.status(503).json({ error: "Google sign-in is not configured" });
    return;
  }
  const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/")
    ? req.query.returnTo
    : "/dashboard";
  const statePayload = Buffer.from(JSON.stringify({ returnTo, ts: Date.now() }), "utf8").toString("base64url");
  const state = signOAuthState(statePayload);
  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: google.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/auth/google/callback", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const google = googleOAuthConfig();
  if (!google) {
    res.status(503).send("Google sign-in is not configured");
    return;
  }
  const err = typeof req.query.error === "string" ? req.query.error : null;
  if (err) {
    res.redirect(`/sign-in?error=${encodeURIComponent(err)}`);
    return;
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const statePayload = verifyOAuthState(stateRaw);
  if (!code || !statePayload) {
    res.status(400).send("Invalid OAuth state");
    return;
  }
  let returnTo = "/dashboard";
  try {
    const parsed = JSON.parse(Buffer.from(statePayload, "base64url").toString("utf8")) as { returnTo?: string };
    if (parsed.returnTo?.startsWith("/")) returnTo = parsed.returnTo;
  } catch {
    /* keep default */
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: google.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    res.redirect(`/sign-in?error=google_token`);
    return;
  }
  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  const idToken = tokenJson.id_token;
  if (!idToken) {
    res.redirect(`/sign-in?error=google_token`);
    return;
  }
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    res.redirect(`/sign-in?error=google_token`);
    return;
  }
  const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  const sub = claims.sub?.trim();
  const email = claims.email?.trim().toLowerCase();
  if (!sub || !email || claims.email_verified === false) {
    res.redirect(`/sign-in?error=google_email`);
    return;
  }

  let userId: string | null = null;
  const [oauthRow] = await db
    .select({ userId: authOauthIdentitiesTable.userId })
    .from(authOauthIdentitiesTable)
    .where(and(eq(authOauthIdentitiesTable.provider, "google"), eq(authOauthIdentitiesTable.providerAccountId, sub)))
    .limit(1);
  if (oauthRow) {
    userId = oauthRow.userId;
  } else {
    const [byEmail] = await db
      .select({ userId: authCredentialsTable.userId })
      .from(authCredentialsTable)
      .where(eq(authCredentialsTable.email, email))
      .limit(1);
    userId = byEmail?.userId ?? null;
    if (!userId) {
      userId = newUserId();
      await db.insert(authCredentialsTable).values({
        userId,
        email,
        emailVerified: 1,
        passwordHash: null,
      });
      await upsertUserProfile(userId, { loginEmail: email });
    } else {
      await db
        .update(authCredentialsTable)
        .set({ emailVerified: 1, updatedAt: new Date() })
        .where(eq(authCredentialsTable.userId, userId));
    }
    const [existingOauth] = await db
      .select({ id: authOauthIdentitiesTable.id })
      .from(authOauthIdentitiesTable)
      .where(
        and(eq(authOauthIdentitiesTable.provider, "google"), eq(authOauthIdentitiesTable.providerAccountId, sub)),
      )
      .limit(1);
    if (!existingOauth) {
      await db.insert(authOauthIdentitiesTable).values({
        userId,
        provider: "google",
        providerAccountId: sub,
      });
    }
  }

  if (!userId) {
    res.redirect("/sign-in?error=google_account");
    return;
  }

  const { sessionId, expiresAt } = await createSession(userId);
  setSessionCookie(res, sessionId, expiresAt);
  res.redirect(returnTo);
});

export default router;
