import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type GraphicsModuleExampleItem = {
  templateSlug: string;
  name: string;
  description: string | null;
  icon: string | null;
  exampleImageUrl: string | null;
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

export async function saveAdminGraphicsModuleExample(payload: {
  productCategoryName: string;
  templateSlug: string;
  exampleImageUrl: string;
}): Promise<void> {
  await fetchJson(`${basePath}/api/admin/graphics-module-examples`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  const saveExample = useMutation({
    mutationFn: saveAdminGraphicsModuleExample,
    onSuccess: invalidate,
  });

  return { createCategory, removeCategory, saveExample, invalidate };
}
