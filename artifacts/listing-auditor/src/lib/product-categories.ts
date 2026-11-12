import { useQuery } from "@tanstack/react-query";
import { AMAZON_CATEGORIES } from "@/lib/amazon-categories";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const DEFAULT_PRODUCT_CATEGORY = "Default";

const FALLBACK_CATEGORIES = [DEFAULT_PRODUCT_CATEGORY, ...AMAZON_CATEGORIES];

async function fetchProductCategories(): Promise<string[]> {
  const res = await fetch(`${basePath}/api/product-categories`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load categories");
  const data = (await res.json()) as { categories?: string[] };
  const list = data.categories?.filter(Boolean) ?? [];
  if (list.length === 0) return [...FALLBACK_CATEGORIES];
  return list;
}

export function useProductCategories() {
  const query = useQuery({
    queryKey: ["product-categories"],
    queryFn: fetchProductCategories,
    staleTime: 60_000,
  });
  const categories = query.data ?? FALLBACK_CATEGORIES;
  return { ...query, categories };
}

export function filterProductCategories(categories: readonly string[], search: string): string[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...categories];
  return categories.filter((c) => c.toLowerCase().includes(q));
}
