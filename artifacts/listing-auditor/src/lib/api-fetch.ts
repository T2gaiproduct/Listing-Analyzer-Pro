export class ApiFetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiFetchError";
  }
}

let tokenGetter: (() => Promise<string | null>) | null = null;

export function setApiTokenGetter(getter: (() => Promise<string | null>) | null) {
  tokenGetter = getter;
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
