const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type NativeAuthConfig = {
  enabled: boolean;
  googleOAuth: { clientId: string; redirectPath: string } | null;
};

export function nativeAuthApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${p}`;
}

/** Parse JSON from /api/auth/* responses; surface HTML/404 proxy errors clearly. */
export async function fetchNativeAuthJson<T extends { error?: string }>(
  path: string,
  init?: RequestInit,
): Promise<{ res: Response; data: T | null; parseError: string | null }> {
  const res = await fetch(nativeAuthApiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!text.trim()) {
    return { res, data: null, parseError: `Empty response (${res.status})` };
  }
  try {
    const data = JSON.parse(text) as T;
    return { res, data, parseError: null };
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 120);
    return {
      res,
      data: null,
      parseError:
        res.status === 404
          ? "API route not found — check nginx /api proxy and NATIVE_AUTH_ENABLED on the server."
          : `Non-JSON response (${res.status}): ${snippet}`,
    };
  }
}

export async function loadNativeAuthConfig(): Promise<NativeAuthConfig | null> {
  try {
    const { data, parseError } = await fetchNativeAuthJson<NativeAuthConfig>("/api/auth/config", {
      method: "GET",
    });
    if (parseError || !data) return null;
    return data;
  } catch {
    return null;
  }
}
