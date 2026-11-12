import { getActiveWorkspaceId, WORKSPACE_HEADER } from "@/lib/workspace-header";
import { showCreditUsageToast, type CreditUsagePayload } from "@/lib/credit-usage-toast";
import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";

export class ApiFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
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

const TOKEN_TIMEOUT_MS = 12_000;

async function resolveAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      tokenGetter(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ApiFetchInit = RequestInit & { skipWorkspaceHeader?: boolean };

/** Same-origin /api fetch with Bearer + optional cookie-only retry on Cloudflare preview. */
export async function apiFetch(url: string, init?: ApiFetchInit): Promise<Response> {
  const headers = await authHeaders(init);
  const requestInit = { credentials: "include" as RequestCredentials, ...init, headers };
  const doFetch = (h: Headers) => fetch(url, { ...requestInit, headers: h });
  let res = await doFetch(headers);
  if (
    res.status === 401
    && isCloudflareQuickPreviewHost()
    && headers.has("Authorization")
  ) {
    const cookieOnly = new Headers(headers);
    cookieOnly.delete("Authorization");
    res = await doFetch(cookieOnly);
  }
  return res;
}

async function authHeaders(init?: ApiFetchInit): Promise<Headers> {
  const headers = new Headers(init?.headers);
  const token = await resolveAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!init?.skipWorkspaceHeader) {
    const workspaceId = getActiveWorkspaceId();
    if (workspaceId) headers.set(WORKSPACE_HEADER, String(workspaceId));
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
      const requestInit = { credentials: "include" as RequestCredentials, ...init, headers };
      const doFetch = (h: Headers) => nativeFetch!(input, { ...requestInit, headers: h });
      let res = await doFetch(headers);
      if (
        res.status === 401
        && isCloudflareQuickPreviewHost()
        && headers.has("Authorization")
      ) {
        const cookieOnly = new Headers(headers);
        cookieOnly.delete("Authorization");
        res = await doFetch(cookieOnly);
      }
      return res;
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
  init?: ApiFetchInit,
): Promise<T> {
  const res = await apiFetch(url, init);
  return readApiJson<T>(res);
}

type HealthzPayload = {
  staleProcess?: boolean;
  clerkKeyPair?: string;
  clerkProxySecret?: string;
  apiBuildId?: string;
};

async function authFailureHint(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  let health: HealthzPayload | null = null;
  try {
    const res = await fetch(`${basePath}/api/healthz`, { cache: "no-store" });
    if (res.ok) health = (await res.json()) as HealthzPayload;
  } catch {
    /* ignore */
  }

  if (health?.staleProcess === true) {
    return "The API server is running an older build. Hard-refresh this page (Ctrl+Shift+R). On Cloud Agent, run bash scripts/dev-stack-reload.sh, then sign in again.";
  }
  if (health?.clerkKeyPair === "mismatch") {
    return "Server Clerk keys do not match (jwk-kid-mismatch). Update CLERK_SECRET_KEY and VITE_CLERK_PUBLISHABLE_KEY to the same Clerk app, restart the dev stack, then sign in again.";
  }
  if (health?.clerkProxySecret === "invalid" || health?.clerkProxySecret === "missing") {
    return "The server CLERK_SECRET_KEY is missing or invalid. Fix environment secrets, restart the dev stack, then sign in again.";
  }

  const localBuild = (import.meta.env.VITE_APP_BUILD_ID as string | undefined)?.trim();
  if (localBuild && localBuild !== "dev") {
    try {
      const res = await fetch(`${basePath}/build-id.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const remote = ((await res.json()) as { buildId?: string }).buildId?.trim();
        if (remote && remote !== localBuild) {
          return "Your browser is on an older app build. Hard-refresh (Ctrl+Shift+R) or wait for the automatic refresh, then sign in again.";
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (isCloudflareQuickPreviewHost()) {
    return "On Cloudflare preview links, sign out and sign in again on the same hostname shown in the address bar.";
  }

  return null;
}

async function sessionVerificationMessage(): Promise<string> {
  const hint = await authFailureHint();
  if (hint) return hint;
  return "Your session could not be verified. Sign out and sign in again on this site.";
}

/** User-facing message for failed API calls (including Orval ApiError 401). */
export async function describeApiError(err: unknown): Promise<string> {
  if (err instanceof ApiFetchError) return err.message;
  const status = typeof err === "object" && err !== null && "status" in err
    ? Number((err as { status: unknown }).status)
    : NaN;
  if (status === 401) return sessionVerificationMessage();
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Please try again.";
}

/** Parse a fetch Response as JSON; surfaces HTML/error-page responses clearly. */
export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      const message =
        res.status === 401
          ? await sessionVerificationMessage()
          : `Server error (${res.status}). Restart the API server after deploying the latest code.`;
      throw new ApiFetchError(message, res.status);
    }
    return {} as T;
  }

  if (text.trimStart().startsWith("<")) {
    const message = res.status === 502
      ? "The API server is not responding (502 Bad Gateway). On the server, check pm2 (or your process manager) and nginx /api upstream."
      : res.status === 503 || res.status === 504
        ? `The API is temporarily unavailable (${res.status}). Restart the API server or check nginx/upstream timeouts.`
        : "The API returned a web page instead of JSON. Deploy/restart the API server with the latest code.";
    throw new ApiFetchError(message, res.status);
  }

  try {
    const data = JSON.parse(text) as T & {
      error?: string;
      message?: string;
      code?: string;
      hint?: string;
      apiBuildId?: string;
      staleProcess?: boolean;
    };
    if (!res.ok) {
      const raw = data.error ?? data.message ?? `Server error (${res.status})`;
      let message =
        res.status === 401 && (!raw || raw === "Unauthorized")
          ? await sessionVerificationMessage()
          : raw;
      if (data.apiBuildId && res.status !== 401) {
        message = `${message} (API build ${data.apiBuildId})`;
      }
      if (data.staleProcess === true) {
        message =
          "The API server is running an older build. Ask your agent to run bash scripts/dev-stack-reload.sh, then hard-refresh this page and sign in again.";
      }
      if (data.hint?.trim()) {
        message = `${message} ${data.hint.trim()}`;
      }
      throw new ApiFetchError(message, res.status, data.code);
    }
    const usage = (data as { creditUsage?: CreditUsagePayload }).creditUsage;
    if (usage?.title && usage?.message) {
      showCreditUsageToast(usage);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiFetchError) throw error;
    throw new ApiFetchError(
      "Invalid response from server. Restart the API after deploying the latest code.",
      res.status,
    );
  }
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
