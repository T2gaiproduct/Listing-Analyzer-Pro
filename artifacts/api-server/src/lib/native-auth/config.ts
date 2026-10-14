export function isNativeAuthEnabled(): boolean {
  return process.env.NATIVE_AUTH_ENABLED === "true";
}

export function authSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret && isNativeAuthEnabled()) {
    throw new Error("AUTH_SESSION_SECRET is required when NATIVE_AUTH_ENABLED=true");
  }
  return secret ?? "dev-native-auth-secret-change-me";
}

export const AUTH_SESSION_COOKIE = "sl_session";
export const AUTH_SESSION_DAYS = 30;

export function authCookieSecure(): boolean {
  if (process.env.AUTH_COOKIE_SECURE === "false") return false;
  if (process.env.AUTH_COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function googleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
