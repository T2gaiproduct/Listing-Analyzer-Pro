import assert from "node:assert/strict";
import {
  activeWalmartOAuthCredentialPrefix,
  parseWalmartOAuthDefaultEnvironment,
  resolveActiveWalmartOAuthEnvironment,
  walmartOAuthDefaultEnvironment,
} from "./walmart-oauth-config.js";

function testParseDefaultEnvironment(): void {
  assert.equal(parseWalmartOAuthDefaultEnvironment(undefined), "production");
  assert.equal(parseWalmartOAuthDefaultEnvironment(""), "production");
  assert.equal(parseWalmartOAuthDefaultEnvironment("production"), "production");
  assert.equal(parseWalmartOAuthDefaultEnvironment("prod"), "production");
  assert.equal(parseWalmartOAuthDefaultEnvironment("sandbox"), "sandbox");
  assert.equal(parseWalmartOAuthDefaultEnvironment("sandox"), "sandbox");
  assert.equal(parseWalmartOAuthDefaultEnvironment("  SANDBOX  "), "sandbox");
}

function testActiveCredentialPrefix(): void {
  const prev = process.env.WALMART_OAUTH_DEFAULT_ENV;
  process.env.WALMART_OAUTH_DEFAULT_ENV = "sandbox";
  assert.equal(activeWalmartOAuthCredentialPrefix(), "WALMART_SANDBOX_");
  process.env.WALMART_OAUTH_DEFAULT_ENV = "production";
  assert.equal(activeWalmartOAuthCredentialPrefix(), "WALMART_PRODUCTION_");
  if (prev === undefined) delete process.env.WALMART_OAUTH_DEFAULT_ENV;
  else process.env.WALMART_OAUTH_DEFAULT_ENV = prev;
}

function testResolveActiveUsesDefaultEnvCredentials(): void {
  const prevEnv = process.env.WALMART_OAUTH_DEFAULT_ENV;
  const prevId = process.env.WALMART_SANDBOX_CLIENT_ID;
  const prevSecret = process.env.WALMART_SANDBOX_CLIENT_SECRET;
  const prevProdId = process.env.WALMART_PRODUCTION_CLIENT_ID;

  delete process.env.WALMART_PRODUCTION_CLIENT_ID;
  process.env.WALMART_OAUTH_DEFAULT_ENV = "sandbox";
  process.env.WALMART_SANDBOX_CLIENT_ID = "sb-id";
  process.env.WALMART_SANDBOX_CLIENT_SECRET = "sb-secret";
  assert.equal(walmartOAuthDefaultEnvironment(), "sandbox");
  assert.equal(resolveActiveWalmartOAuthEnvironment(), "sandbox");

  process.env.WALMART_OAUTH_DEFAULT_ENV = "production";
  assert.equal(resolveActiveWalmartOAuthEnvironment(), null);

  if (prevEnv === undefined) delete process.env.WALMART_OAUTH_DEFAULT_ENV;
  else process.env.WALMART_OAUTH_DEFAULT_ENV = prevEnv;
  if (prevId === undefined) delete process.env.WALMART_SANDBOX_CLIENT_ID;
  else process.env.WALMART_SANDBOX_CLIENT_ID = prevId;
  if (prevSecret === undefined) delete process.env.WALMART_SANDBOX_CLIENT_SECRET;
  else process.env.WALMART_SANDBOX_CLIENT_SECRET = prevSecret;
  if (prevProdId === undefined) delete process.env.WALMART_PRODUCTION_CLIENT_ID;
  else process.env.WALMART_PRODUCTION_CLIENT_ID = prevProdId;
}

testParseDefaultEnvironment();
testActiveCredentialPrefix();
testResolveActiveUsesDefaultEnvCredentials();
console.log("walmart-oauth-config: ok");
