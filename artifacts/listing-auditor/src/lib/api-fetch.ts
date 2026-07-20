export class ApiFetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiFetchError";
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
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
