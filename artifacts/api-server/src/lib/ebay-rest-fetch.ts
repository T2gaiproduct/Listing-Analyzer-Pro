import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayOAuthEndpoints } from "./ebay-oauth-config.js";

export async function ebayRestFetch(
  environment: EbayOAuthEnvironment,
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { apiBaseUrl } = ebayOAuthEndpoints(environment);
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Accept-Language": "en-US",
    "Content-Language": "en-US",
  };
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

export function parseEbayRestError(text: string, fallback: string): string {
  try {
    const data = JSON.parse(text) as { errors?: Array<{ message?: string; longMessage?: string }> };
    const messages = (data.errors ?? [])
      .map((e) => e.longMessage?.trim() || e.message?.trim())
      .filter(Boolean);
    if (messages.length > 0) return messages.join(" ");
  } catch {
    // plain text
  }
  return text.trim() || fallback;
}
