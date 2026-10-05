import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayRestFetch, parseEbayRestError } from "./ebay-rest-fetch.js";

export type EbayCategorySuggestion = {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
};

const MARKETPLACE_ID = "EBAY_US";

let cachedTreeId: { environment: EbayOAuthEnvironment; treeId: string } | null = null;

async function resolveCategoryTreeId(
  environment: EbayOAuthEnvironment,
  accessToken: string,
): Promise<string> {
  if (cachedTreeId?.environment === environment) return cachedTreeId.treeId;

  const res = await ebayRestFetch(
    environment,
    accessToken,
    `/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${MARKETPLACE_ID}`,
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not load eBay category tree."));
  }
  const data = JSON.parse(text) as { categoryTreeId?: string };
  const treeId = data.categoryTreeId?.trim();
  if (!treeId) throw new Error("eBay did not return a category tree id.");
  cachedTreeId = { environment, treeId };
  return treeId;
}

export async function suggestEbayCategories(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  query: string;
}): Promise<EbayCategorySuggestion[]> {
  const q = input.query.trim();
  if (q.length < 2) return [];

  const treeId = await resolveCategoryTreeId(input.environment, input.accessToken);
  const encodedQ = encodeURIComponent(q);
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodedQ}`,
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "eBay category search failed."));
  }

  const data = JSON.parse(text) as {
    categorySuggestions?: Array<{
      category?: {
        categoryId?: string;
        categoryName?: string;
      };
      categoryTreeNodeAncestors?: Array<{ categoryName?: string }>;
    }>;
  };

  const results: EbayCategorySuggestion[] = [];
  for (const row of data.categorySuggestions ?? []) {
    const categoryId = row.category?.categoryId?.trim();
    const categoryName = row.category?.categoryName?.trim();
    if (!categoryId || !categoryName) continue;
    const ancestors = (row.categoryTreeNodeAncestors ?? [])
      .map((a) => a.categoryName?.trim())
      .filter(Boolean) as string[];
    const categoryPath = [...ancestors, categoryName].join(" › ");
    results.push({ categoryId, categoryName, categoryPath });
  }
  return results.slice(0, 20);
}

export type EbayCategoryAspectField = {
  name: string;
  required: boolean;
  values: string[];
  /** When true, seller must pick from `values` when provided. */
  selectionOnly: boolean;
};

export async function fetchEbayCategoryAspects(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  categoryId: string;
}): Promise<EbayCategoryAspectField[]> {
  const categoryId = input.categoryId.trim();
  if (!categoryId) return [];

  const treeId = await resolveCategoryTreeId(input.environment, input.accessToken);
  const res = await ebayRestFetch(
    input.environment,
    input.accessToken,
    `/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`,
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseEbayRestError(text, "Could not load eBay item specifics for this category."));
  }

  const data = JSON.parse(text) as {
    aspects?: Array<{
      localizedAspectName?: string;
      aspectConstraint?: {
        aspectRequired?: boolean;
        aspectMode?: string;
      };
      aspectValues?: Array<{ localizedValue?: string }>;
    }>;
  };

  const fields: EbayCategoryAspectField[] = [];
  for (const row of data.aspects ?? []) {
    const name = row.localizedAspectName?.trim();
    if (!name) continue;
    const values = (row.aspectValues ?? [])
      .map((v) => v.localizedValue?.trim())
      .filter(Boolean) as string[];
    const mode = row.aspectConstraint?.aspectMode ?? "";
    fields.push({
      name,
      required: row.aspectConstraint?.aspectRequired === true,
      values,
      selectionOnly: mode === "SELECTION_ONLY",
    });
  }

  return fields.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
