import { randomUUID } from "node:crypto";

export type WalmartEnvironment = "sandbox" | "production";

export function parseWalmartEnvironment(raw: unknown): WalmartEnvironment {
  return raw === "sandbox" ? "sandbox" : "production";
}

export function walmartApiBaseUrl(environment: WalmartEnvironment): string {
  return environment === "sandbox"
    ? "https://sandbox.walmartapis.com"
    : "https://marketplace.walmartapis.com";
}

export function walmartTokenUrl(environment: WalmartEnvironment): string {
  return `${walmartApiBaseUrl(environment)}/v3/token`;
}

export class WalmartOAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "WalmartOAuthError";
  }
}

function parseWalmartErrorBody(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: string;
      error_description?: string;
      message?: string;
      errors?: Array<{ description?: string; info?: string; message?: string }>;
    };
    const first = parsed.errors?.[0];
    return (
      parsed.error_description
      || parsed.message
      || first?.description
      || first?.info
      || first?.message
      || parsed.error
      || null
    );
  } catch {
    return trimmed.slice(0, 240);
  }
}

export async function refreshWalmartAccessToken(input: {
  partnerId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  environment: WalmartEnvironment;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const partnerId = input.partnerId.trim();
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  const refreshToken = input.refreshToken.trim();
  if (!partnerId || !clientId || !clientSecret || !refreshToken) {
    throw new WalmartOAuthError("Walmart Partner ID, Client ID, Client secret, and Refresh token are required.");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  const res = await fetch(walmartTokenUrl(input.environment), {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "WM_SVC.NAME": "Walmart Marketplace",
      "WM_QOS.CORRELATION_ID": randomUUID(),
      "WM_PARTNER.ID": partnerId,
      "WM_CONSUMER.ID": clientId,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    const detail = parseWalmartErrorBody(text);
    throw new WalmartOAuthError(
      detail
        ? `Walmart token request failed (${res.status}): ${detail}`
        : `Walmart token request failed (${res.status}). Check Partner ID, Client ID, secret, and refresh token.`,
      res.status,
    );
  }

  let parsed: { access_token?: string; expires_in?: number };
  try {
    parsed = JSON.parse(text) as { access_token?: string; expires_in?: number };
  } catch {
    throw new WalmartOAuthError("Walmart token response was not JSON.");
  }
  const accessToken = parsed.access_token?.trim();
  if (!accessToken) {
    throw new WalmartOAuthError("Walmart token response did not include an access token.");
  }
  return {
    accessToken,
    expiresIn: Number(parsed.expires_in ?? 900),
  };
}
