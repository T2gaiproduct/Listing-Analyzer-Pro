import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type GraphicsModuleExampleImage = {
  id: number;
  url: string;
};

export type GraphicsModuleExampleItem = {
  templateSlug: string;
  name: string;
  description: string | null;
  icon: string | null;
  /** First image — backward compatible with single-image clients. */
  exampleImageUrl: string | null;
  exampleImages: GraphicsModuleExampleImage[];
  sortOrder: number;
};

export type GraphicsModuleExamplesPayload = {
  requestedCategory: string | null;
  resolvedCategory: string;
  usedDefaultFallback: boolean;
  examples: GraphicsModuleExampleItem[];
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useGraphicsModuleExamples(productCategory: string | null | undefined) {
  const categoryKey = productCategory?.trim() || "";
  return useQuery({
    queryKey: ["graphics-module-examples", categoryKey],
    queryFn: () =>
      fetchJson<GraphicsModuleExamplesPayload>(
        `${basePath}/api/graphics-module-examples?category=${encodeURIComponent(categoryKey)}`,
      ),
    staleTime: 30_000,
  });
}

export const DEFAULT_CATEGORY_FOR_ADMIN = "Default";

export function useAdminGraphicsModuleExamples(productCategory: string | null | undefined) {
  const categoryKey = productCategory?.trim() || DEFAULT_CATEGORY_FOR_ADMIN;
  return useQuery({
    queryKey: ["admin", "graphics-module-examples", categoryKey],
    queryFn: () =>
      fetchJson<GraphicsModuleExamplesPayload>(
        `${basePath}/api/admin/graphics-module-examples?category=${encodeURIComponent(categoryKey)}`,
      ),
    staleTime: 10_000,
  });
}

export type AdminProductCategory = {
  id: number;
  name: string;
  isSystem: boolean;
  sortOrder: number;
};

export function useAdminProductCategories() {
  return useQuery({
    queryKey: ["admin", "product-categories"],
    queryFn: () =>
      fetchJson<{ categories: AdminProductCategory[] }>(`${basePath}/api/admin/product-categories`),
    staleTime: 30_000,
  });
}

export async function uploadAdminGraphicsExampleImage(dataUrl: string): Promise<string> {
  const { url } = await fetchJson<{ url: string }>(`${basePath}/api/admin/graphics-module-example-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  return url;
}

/** Append a studio example image (PUT with a non-empty URL). */
export async function addAdminGraphicsModuleExample(payload: {
  productCategoryName: string;
  templateSlug: string;
  exampleImageUrl: string;
}): Promise<{ id: number }> {
  return fetchJson<{ ok: true; id: number }>(`${basePath}/api/admin/graphics-module-examples`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Remove one example by row id, or all examples for category + slug when exampleId is omitted. */
export async function deleteAdminGraphicsModuleExample(payload: {
  productCategoryName: string;
  templateSlug: string;
  exampleId?: number;
}): Promise<void> {
  await fetchJson(`${basePath}/api/admin/graphics-module-examples`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productCategoryName: payload.productCategoryName,
      templateSlug: payload.templateSlug,
      exampleImageUrl: "",
      ...(payload.exampleId != null ? { exampleId: payload.exampleId } : {}),
    }),
  });
}

export async function deleteAdminGraphicsModuleExampleById(id: number): Promise<void> {
  await fetchJson(`${basePath}/api/admin/graphics-module-examples/${id}`, { method: "DELETE" });
}

export async function createAdminProductCategory(name: string): Promise<void> {
  await fetchJson(`${basePath}/api/admin/product-categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteAdminProductCategory(id: number): Promise<void> {
  await fetchJson(`${basePath}/api/admin/product-categories/${id}`, { method: "DELETE" });
}

export function useAdminProductCategoryMutations() {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "product-categories"] });
    await queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "graphics-module-examples"] });
    await queryClient.invalidateQueries({ queryKey: ["graphics-module-examples"] });
  };

  const createCategory = useMutation({
    mutationFn: createAdminProductCategory,
    onSuccess: invalidate,
  });
  const removeCategory = useMutation({
    mutationFn: deleteAdminProductCategory,
    onSuccess: invalidate,
  });
  const addExample = useMutation({
    mutationFn: addAdminGraphicsModuleExample,
    onSuccess: invalidate,
  });
  const removeExample = useMutation({
    mutationFn: deleteAdminGraphicsModuleExample,
    onSuccess: invalidate,
  });
  const removeExampleById = useMutation({
    mutationFn: deleteAdminGraphicsModuleExampleById,
    onSuccess: invalidate,
  });

  return { createCategory, removeCategory, addExample, removeExample, removeExampleById, invalidate };
}
