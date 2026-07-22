export class ApiFetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiFetchError";
  }
}

let tokenGetter: (() => Promise<string | null>) | null = null;
let nativeFetch: typeof fetch | null = null;
let apiAuthReady = false;

const FETCH_PATCHED_KEY = "__laApiFetchPatched";

export function setApiTokenGetter(getter: (() => Promise<string | null>) | null) {
  tokenGetter = getter;
}

export function setApiAuthReady(ready: boolean) {
  apiAuthReady = ready;
}

export function isApiAuthReady(): boolean {
  return apiAuthReady;
}

async function authHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers);
  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Fall back to cookie-based session only.
    }
  }
  return headers;
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isSameOriginApiRequest(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    const path = parsed.pathname;
    return parsed.origin === window.location.origin && (path === "/api" || path.startsWith("/api/"));
  } catch {
    return url.startsWith("/api/") || url.startsWith("/api?");
  }
}

/** Attach Clerk Bearer tokens to all same-origin /api/* fetch calls (fixes Cloudflare/proxy auth). */
export function installApiAuthFetch(): void {
  if (typeof window === "undefined") return;
  const win = window as Window & { [FETCH_PATCHED_KEY]?: boolean };
  if (win[FETCH_PATCHED_KEY]) return;

  nativeFetch = window.fetch.bind(window);
  win[FETCH_PATCHED_KEY] = true;

  window.fetch = async (input, init) => {
    const url = resolveRequestUrl(input);
    if (isSameOriginApiRequest(url)) {
      const headers = await authHeaders(init);
      return nativeFetch!(input, { credentials: "include", ...init, headers });
    }
    return nativeFetch!(input, init);
  };
}

export function uninstallApiAuthFetch(): void {
  if (typeof window === "undefined" || !nativeFetch) return;
  window.fetch = nativeFetch;
  const win = window as Window & { [FETCH_PATCHED_KEY]?: boolean };
  delete win[FETCH_PATCHED_KEY];
  nativeFetch = null;
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const headers = await authHeaders(init);
  const res = await fetch(url, { credentials: "include", ...init, headers });
  if (!res.ok) {
    throw new ApiFetchError(`Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

/** Fetch JSON and guarantee an array — prevents `.filter is not a function` crashes. */
export async function fetchJsonArray<T>(
  url: string,
  init?: RequestInit,
): Promise<T[]> {
  try {
    const data = await fetchJson<unknown>(url, init);
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}
