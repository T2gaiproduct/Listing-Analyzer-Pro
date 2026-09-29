import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GraphicsImageTypeOption } from "@/components/graphics-type-customize-ui";
import { GRAPHICS_IMAGE_TYPES } from "@/lib/graphics-image-types";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type ImagePromptTemplateCategory = "graphics" | "aplus";

export type ImagePromptTemplateOption = {
  slug: string;
  category: ImagePromptTemplateCategory;
  name: string;
  description?: string | null;
  icon?: string | null;
  isUserCustomType?: boolean;
  sortOrder: number;
};

export type ImagePromptTemplateMetadata = {
  icon?: string;
  graphicsBucket?: "feature" | "lifestyle";
  isUserCustomType?: boolean;
};

export type ImagePromptTemplateAdmin = {
  id: number;
  slug: string;
  category: ImagePromptTemplateCategory;
  name: string;
  description?: string | null;
  enabled: boolean;
  isSystem: boolean;
  sortOrder: number;
  promptTemplate: string;
  headlineTemplate?: string | null;
  bodyTemplate?: string | null;
  metadata: ImagePromptTemplateMetadata;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useImagePromptTemplates(category: ImagePromptTemplateCategory) {
  return useQuery({
    queryKey: ["image-prompt-templates", category],
    queryFn: () =>
      fetchJson<{ templates: ImagePromptTemplateOption[] }>(
        `${basePath}/api/image-prompt-templates?category=${category}`,
      ),
    staleTime: 60_000,
  });
}

export function useGraphicsImageTypesFromApi(): {
  imageTypes: GraphicsImageTypeOption[];
  isLoading: boolean;
} {
  const { data, isLoading } = useImagePromptTemplates("graphics");
  const imageTypes = useMemo(() => {
    const templates = data?.templates;
    if (!templates?.length) return GRAPHICS_IMAGE_TYPES;
    return templates.map((t) => ({
      id: t.slug,
      label: t.name,
      desc: t.description ?? "",
      icon: t.icon ?? "✨",
    }));
  }, [data]);
  return { imageTypes, isLoading };
}

export type AplusModuleCard = {
  id: string;
  label: string;
  desc: string;
  icon: string;
};

const FALLBACK_APLUS_MODULES: AplusModuleCard[] = [
  { id: "hero", label: "Hero Banner", desc: "High-impact visual for the top of the page", icon: "🖼️" },
  { id: "features", label: "Features Highlights", desc: "Detailed breakdown of key product benefits", icon: "🔍" },
  { id: "comparison", label: "Comparison Charts", desc: "Side-by-side comparison with competitors or models", icon: "📊" },
  { id: "brand_story", label: "Brand Story", desc: "Connect with customers through your brand's mission", icon: "📖" },
];

export function useAplusModuleCards(): { modules: AplusModuleCard[]; isLoading: boolean } {
  const { data, isLoading } = useImagePromptTemplates("aplus");
  const modules = useMemo(() => {
    const templates = data?.templates;
    if (!templates?.length) return FALLBACK_APLUS_MODULES;
    return templates.map((t) => ({
      id: t.slug,
      label: t.name,
      desc: t.description ?? "",
      icon: t.icon ?? "🖼️",
    }));
  }, [data]);
  return { modules, isLoading };
}

export function useAdminImagePromptTemplates(category?: ImagePromptTemplateCategory) {
  const query = category ? `?category=${category}` : "";
  return useQuery({
    queryKey: ["admin", "image-prompt-templates", category ?? "all"],
    queryFn: () =>
      fetchJson<{ templates: ImagePromptTemplateAdmin[] }>(
        `${basePath}/api/admin/image-prompt-templates${query}`,
      ),
  });
}

export async function saveAdminImagePromptTemplate(
  payload: Omit<ImagePromptTemplateAdmin, "id" | "isSystem"> & { id?: number },
) {
  const body = {
    slug: payload.slug,
    category: payload.category,
    name: payload.name,
    description: payload.description ?? null,
    enabled: payload.enabled,
    sortOrder: payload.sortOrder,
    promptTemplate: payload.promptTemplate,
    headlineTemplate: payload.headlineTemplate ?? null,
    bodyTemplate: payload.bodyTemplate ?? null,
    metadata: payload.metadata ?? {},
  };
  const url = payload.id
    ? `${basePath}/api/admin/image-prompt-templates/${payload.id}`
    : `${basePath}/api/admin/image-prompt-templates`;
  const res = await fetchJson<{ template: ImagePromptTemplateAdmin }>(url, {
    method: payload.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.template;
}

export async function deleteAdminImagePromptTemplate(id: number) {
  return fetchJson<{ ok: boolean }>(`${basePath}/api/admin/image-prompt-templates/${id}`, {
    method: "DELETE",
  });
}

export function slugifyImagePromptTemplateName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export const GRAPHICS_PLACEHOLDER_HELP =
  "Placeholders: {{productDesc}} — formatted product name, category, and seller description.";

export const APLUS_PLACEHOLDER_HELP =
  "Placeholders: {{productDesc}}, {{aplusEdgeToEdge}}, EBC fields such as {{heroHeadline}}, {{feature1Title}}, {{gridTitle}}, {{storyHeadline}}, etc.";
