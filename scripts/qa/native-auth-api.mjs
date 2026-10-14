#!/usr/bin/env node
/** Native auth API smoke: register, verify, login, forgot, reset. See scripts/qa/smoke-api.mjs for BASE_URL. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, ""); // pragma: allowlist secret
const email = `native-qa+${randomBytes(4).toString("hex")}@example.com`;
const password = "QaTestPass123!";
const newPassword = "QaNewPass456!";

async function json(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} → non-JSON ${res.status}: ${text.slice(0, 80)}`);
  }
  return { status: res.status, data, headers: res.headers };
}

async function main() {
  console.log("Native auth QA against", BASE);

  const cfg = await json("GET", "/api/auth/config");
  assert.equal(cfg.status, 200, "config status");
  assert.equal(cfg.data?.enabled, true, "NATIVE_AUTH_ENABLED must be true on API");
  console.log("OK /api/auth/config enabled");

  const reg = await json("POST", "/api/auth/register", { email, password });
  assert.equal(reg.status, 201, "register status");
  assert.equal(reg.data?.needsEmailVerification, true, "register needs verification");
  const code = reg.data?.devEmailCode;
  assert.ok(code, "devEmailCode in non-production");
  console.log("OK register");

  const verify = await json("POST", "/api/auth/verify-email-code", { email, code });
  assert.equal(verify.status, 200, "verify status");
  assert.ok(verify.data?.userId, "verify userId");
  console.log("OK verify-email-code");

  const login = await json("POST", "/api/auth/login", { email, password });
  assert.equal(login.status, 200, "login status");
  assert.ok(login.data?.token, "login token");
  console.log("OK login");

  const forgot = await json("POST", "/api/auth/forgot-password", { email });
  assert.equal(forgot.status, 200, "forgot status");
  assert.equal(forgot.data?.ok, true, "forgot ok");
  const resetToken = forgot.data?.devResetToken;
  assert.ok(resetToken, "devResetToken");
  console.log("OK forgot-password");

  const reset = await json("POST", "/api/auth/reset-password", { token: resetToken, password: newPassword });
  assert.equal(reset.status, 200, "reset status");
  assert.equal(reset.data?.ok, true, "reset ok");
  console.log("OK reset-password");

  const loginNew = await json("POST", "/api/auth/login", { email, password: newPassword });
  assert.equal(loginNew.status, 200, "login after reset");
  console.log("OK login with new password");

  console.log("\nAll native auth API checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
