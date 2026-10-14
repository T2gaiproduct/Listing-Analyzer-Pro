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
import { hashPassword, verifyPassword, generateResetToken, hashResetTokenStable } from "../lib/native-auth/password.js";
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
const router: IRouter = Router();

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

  const { sessionId, expiresAt } = await createSession(cred.userId);
  setSessionCookie(res, sessionId, expiresAt);
  res.json({ userId: cred.userId, email: cred.email, token: sessionId });
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
    .select({ userId: authCredentialsTable.userId })
    .from(authCredentialsTable)
    .where(eq(authCredentialsTable.email, email))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const userId = newUserId();
  const passwordHash = await hashPassword(password);
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

  const { sessionId, expiresAt } = await createSession(userId);
  setSessionCookie(res, sessionId, expiresAt);
  res.status(201).json({ userId, email, token: sessionId });
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
    const token = generateResetToken();
    const tokenHash = hashResetTokenStable(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.delete(authPasswordResetTokensTable).where(eq(authPasswordResetTokensTable.userId, cred.userId));
    await db.insert(authPasswordResetTokensTable).values({
      tokenHash,
      userId: cred.userId,
      expiresAt,
    });
    if (process.env.NODE_ENV !== "production") {
      res.json({ ok: true, devResetToken: token });
      return;
    }
  }
  res.json({ ok: true });
});

router.post("/auth/reset-password", async (req, res) => {
  if (nativeDisabled(req, res)) return;
  const body = req.body as { token?: string; password?: string };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token || password.length < 8) {
    res.status(400).json({ error: "Invalid reset request" });
    return;
  }
  const tokenHash = hashResetTokenStable(token);
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
  const passwordHash = await hashPassword(password);
  await db
    .update(authCredentialsTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(authCredentialsTable.userId, row.userId));
  await db.delete(authPasswordResetTokensTable).where(eq(authPasswordResetTokensTable.tokenHash, tokenHash));
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
