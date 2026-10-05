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

type EbayRestErrorRow = {
  message?: string;
  longMessage?: string;
  errorId?: number;
};

export function parseEbayRestErrors(text: string): EbayRestErrorRow[] {
  try {
    const data = JSON.parse(text) as { errors?: EbayRestErrorRow[] };
    return data.errors ?? [];
  } catch {
    return [];
  }
}

export function parseEbayRestError(text: string, fallback: string): string {
  const messages = parseEbayRestErrors(text)
    .map((e) => {
      const body = e.longMessage?.trim() || e.message?.trim();
      if (!body) return "";
      return e.errorId != null ? `[${e.errorId}] ${body}` : body;
    })
    .filter(Boolean);
  if (messages.length > 0) return messages.join(" ");
  return text.trim() || fallback;
}
