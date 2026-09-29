import { useQuery } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type ContentMarketplaceRules = {
  titleMinChars?: number;
  titleMaxChars?: number;
  bulletCount?: number;
  bulletMinChars?: number;
  bulletMaxChars?: number;
  keywordCount?: number;
  descriptionMinWords?: number;
  descriptionMaxWords?: number;
  requiredFields?: string[];
  formattingNotes?: string;
};

export type ContentMarketplaceOption = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  rules?: ContentMarketplaceRules | null;
};

export type ContentMarketplaceAdmin = ContentMarketplaceOption & {
  enabled: boolean;
  isDefault: boolean;
  aiInstructions: string;
  createdAt?: string;
  updatedAt?: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useListingContentMarketplaces() {
  return useQuery({
    queryKey: ["content-marketplaces"],
    queryFn: () =>
      fetchJson<{ marketplaces: ContentMarketplaceOption[] }>(`${basePath}/api/content-marketplaces`),
    staleTime: 60_000,
  });
}

export function useAdminContentMarketplaces() {
  return useQuery({
    queryKey: ["admin", "content-marketplaces"],
    queryFn: () =>
      fetchJson<{ marketplaces: ContentMarketplaceAdmin[] }>(`${basePath}/api/admin/content-marketplaces`),
  });
}

export async function saveAdminContentMarketplace(
  payload: Partial<ContentMarketplaceAdmin> & { slug: string; name: string; aiInstructions: string },
  id?: number,
) {
  const url = id
    ? `${basePath}/api/admin/content-marketplaces/${id}`
    : `${basePath}/api/admin/content-marketplaces`;
  return fetchJson<ContentMarketplaceAdmin>(url, {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: payload.slug,
      name: payload.name,
      description: payload.description ?? null,
      enabled: payload.enabled ?? true,
      isDefault: payload.isDefault ?? false,
      sortOrder: payload.sortOrder ?? 0,
      aiInstructions: payload.aiInstructions,
      rules: payload.rules ?? null,
    }),
  });
}

export async function deleteAdminContentMarketplace(id: number) {
  return fetchJson<{ ok: boolean }>(`${basePath}/api/admin/content-marketplaces/${id}`, {
    method: "DELETE",
  });
}

export function pickDefaultMarketplaceId(
  marketplaces: ContentMarketplaceOption[] | undefined,
  savedId?: number | null,
): number | undefined {
  if (!marketplaces?.length) return undefined;
  if (savedId != null && marketplaces.some((m) => m.id === savedId)) return savedId;
  return marketplaces[0]?.id;
}
