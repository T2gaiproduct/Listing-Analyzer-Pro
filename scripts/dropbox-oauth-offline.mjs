#!/usr/bin/env node
/**
 * One-time Dropbox setup for Excel export image URLs (long-lived refresh token).
 *
 *   DROPBOX_APP_KEY=... DROPBOX_APP_SECRET=... node scripts/dropbox-oauth-offline.mjs authorize
 *   # Open the printed URL, approve, copy ?code= from redirect
 *   DROPBOX_APP_KEY=... DROPBOX_APP_SECRET=... node scripts/dropbox-oauth-offline.mjs exchange PASTE_CODE
 *
 * Register redirect URI in Dropbox app console: http://127.0.0.1:53682/
 * Scopes: files.content.write, sharing.write
 */

const REDIRECT_URI = process.env.DROPBOX_OAUTH_REDIRECT_URI ?? "http://127.0.0.1:53682/";

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return v;
}

const [, , command, codeArg] = process.argv;

if (command === "authorize") {
  const clientId = requireEnv("DROPBOX_APP_KEY");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    token_access_type: "offline",
    redirect_uri: REDIRECT_URI,
    scope: "files.content.write sharing.write",
  });
  console.log("\n1. In Dropbox App Console → OAuth 2, add Redirect URI:\n");
  console.log(`   ${REDIRECT_URI}\n`);
  console.log("2. Open this URL in your browser and allow access:\n");
  console.log(`   https://www.dropbox.com/oauth2/authorize?${params.toString()}\n`);
  console.log("3. After redirect, copy the authorization code from the URL (?code=...)\n");
  console.log("4. Run:\n");
  console.log(
    "   DROPBOX_APP_KEY=... DROPBOX_APP_SECRET=... node scripts/dropbox-oauth-offline.mjs exchange YOUR_CODE\n",
  );
  process.exit(0);
}

if (command === "exchange") {
  const clientId = requireEnv("DROPBOX_APP_KEY");
  const clientSecret = requireEnv("DROPBOX_APP_SECRET");
  const code = codeArg?.trim();
  if (!code) {
    console.error("Usage: node scripts/dropbox-oauth-offline.mjs exchange AUTHORIZATION_CODE");
    process.exit(1);
  }

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(text);
    process.exit(1);
  }
  if (!res.ok) {
    console.error("Token exchange failed:", data);
    process.exit(1);
  }
  if (!data.refresh_token) {
    console.error("No refresh_token in response. Use token_access_type=offline (re-run authorize URL).");
    console.error(data);
    process.exit(1);
  }

  console.log("\nAdd these lines to the API server .env (staging/production). Remove DROPBOX_ACCESS_TOKEN.\n");
  console.log(`DROPBOX_APP_KEY=${clientId}`);
  console.log("DROPBOX_APP_SECRET=<keep secret in .env only>");
  console.log(`DROPBOX_REFRESH_TOKEN=${data.refresh_token}`);
  console.log("DROPBOX_EXPORT_PREFIX=/ecommerce-guru/exports");
  console.log("\nThen: pm2 restart listing-auditor-api --update-env\n");
  process.exit(0);
}

console.error("Usage:");
console.error("  node scripts/dropbox-oauth-offline.mjs authorize");
console.error("  node scripts/dropbox-oauth-offline.mjs exchange <code>");
process.exit(1);
