import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type AdminSkillTypeCatalogGroup = "content" | "image" | "audit" | "other";
export type AdminSkillTypeEditorMode = "content" | "image" | "audit" | "generic";

export type AdminSkillType = {
  id: number;
  slug: string;
  label: string;
  catalogGroup: AdminSkillTypeCatalogGroup;
  editorMode: AdminSkillTypeEditorMode;
  handlerKey: string | null;
  description: string;
  enabled: boolean;
  isBuiltin: boolean;
  sortOrder: number;
};

export const FALLBACK_SKILL_TYPES: AdminSkillType[] = [
  {
    id: 0,
    slug: "product_content",
    label: "Product content",
    catalogGroup: "content",
    editorMode: "content",
    handlerKey: "product_content",
    description: "",
    enabled: true,
    isBuiltin: true,
    sortOrder: 10,
  },
  {
    id: 0,
    slug: "product_images",
    label: "Product images",
    catalogGroup: "image",
    editorMode: "image",
    handlerKey: "product_images",
    description: "",
    enabled: true,
    isBuiltin: true,
    sortOrder: 20,
  },
  {
    id: 0,
    slug: "aplus_content",
    label: "A+ content",
    catalogGroup: "image",
    editorMode: "image",
    handlerKey: "aplus_content",
    description: "",
    enabled: true,
    isBuiltin: true,
    sortOrder: 30,
  },
  {
    id: 0,
    slug: "listing_audit",
    label: "Listing audit",
    catalogGroup: "audit",
    editorMode: "audit",
    handlerKey: "listing_audit",
    description: "",
    enabled: true,
    isBuiltin: true,
    sortOrder: 40,
  },
];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useAdminSkillTypes() {
  return useQuery({
    queryKey: ["admin", "ai-skill-types"],
    queryFn: async () => {
      const data = await fetchJson<{ types: AdminSkillType[] }>(`${basePath}/api/admin/ai-skill-types`);
      return data.types.filter((t) => t.enabled);
    },
    staleTime: 60_000,
    placeholderData: FALLBACK_SKILL_TYPES,
  });
}

export function findAdminSkillType(types: AdminSkillType[], slug: string): AdminSkillType | undefined {
  return types.find((t) => t.slug === slug);
}

export function skillTypeEditorMode(
  types: AdminSkillType[],
  slug: string,
): AdminSkillTypeEditorMode {
  return findAdminSkillType(types, slug)?.editorMode ?? "content";
}

export type SkillCatalogTypeLabel = "Product content" | "Image" | "Audit" | string;

export function skillCatalogTypeFromRegistry(
  skillTypeSlug: string,
  types: AdminSkillType[],
  skillKind?: string,
): SkillCatalogTypeLabel {
  if (skillKind === "image_prompt") return "Image";
  const row = findAdminSkillType(types, skillTypeSlug);
  if (row) {
    if (row.catalogGroup === "image") return "Image";
    if (row.catalogGroup === "audit") return "Audit";
    if (row.catalogGroup === "content") return "Product content";
    return row.label;
  }
  if (skillTypeSlug === "listing_audit") return "Audit";
  if (skillTypeSlug === "product_images" || skillTypeSlug === "aplus_content") return "Image";
  if (skillTypeSlug === "product_content") return "Product content";
  return skillTypeSlug.replace(/_/g, " ");
}

export function useAdminSkillTypeMutations() {
  const queryClient = useQueryClient();
  return {
    createType: useMutation({
      mutationFn: (payload: {
        slug: string;
        label: string;
        catalogGroup?: AdminSkillTypeCatalogGroup;
        editorMode?: AdminSkillTypeEditorMode;
        description?: string;
        handlerKey?: string | null;
        sortOrder?: number;
      }) =>
        fetchJson<{ type: AdminSkillType }>(`${basePath}/api/admin/ai-skill-types`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "ai-skill-types"] }),
    }),
    updateType: useMutation({
      mutationFn: (params: { id: number; patch: Partial<Pick<AdminSkillType, "label" | "enabled" | "description" | "sortOrder" | "catalogGroup" | "editorMode">> }) =>
        fetchJson<{ type: AdminSkillType }>(`${basePath}/api/admin/ai-skill-types/${params.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params.patch),
        }),
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "ai-skill-types"] }),
    }),
  };
}
