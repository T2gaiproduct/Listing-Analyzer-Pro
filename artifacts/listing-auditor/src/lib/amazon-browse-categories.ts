import browseCatalog from "@/data/pfa-browse-categories.json";

export type AmazonBrowseCategory = {
  browseNodeId: string;
  browsePath: string;
  label: string;
};

const RECENT_STORAGE_KEY = "amazon-browse-category-recent-v1";
const MAX_RECENT = 8;
const MAX_SEARCH_RESULTS = 120;

export const PFA_BROWSE_CATEGORIES: AmazonBrowseCategory[] = browseCatalog.categories;

export function browsePathSegments(browsePath: string): string[] {
  return browsePath.split(">").map((p) => p.trim()).filter(Boolean);
}

export function leafLabelFromBrowsePath(browsePath: string): string {
  const parts = browsePathSegments(browsePath);
  return parts[parts.length - 1] ?? browsePath;
}

/** First department in the path (e.g. "Toys & Games"). */
export function topLevelBrowseDepartment(browsePath: string): string {
  const parts = browsePathSegments(browsePath);
  return parts[0] ?? "";
}

export function findBrowseCategoryByPath(path: string): AmazonBrowseCategory | undefined {
  const normalized = path.trim();
  if (!normalized) return undefined;
  return PFA_BROWSE_CATEGORIES.find(
    (c) => c.browsePath === normalized || c.label === normalized,
  );
}

export function filterAmazonBrowseCategories(
  categories: readonly AmazonBrowseCategory[],
  search: string,
  limit = MAX_SEARCH_RESULTS,
): AmazonBrowseCategory[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...categories].slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);
  return categories
    .filter((c) => {
      const hay = `${c.label} ${c.browsePath} ${c.browseNodeId}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    })
    .slice(0, limit);
}

export function getRecentBrowseCategoryPaths(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberBrowseCategorySelection(browsePath: string): void {
  if (typeof window === "undefined" || !browsePath.trim()) return;
  try {
    const prev = getRecentBrowseCategoryPaths().filter((p) => p !== browsePath);
    const next = [browsePath, ...prev].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveRecentBrowseCategories(
  categories: readonly AmazonBrowseCategory[],
): AmazonBrowseCategory[] {
  const byPath = new Map(categories.map((c) => [c.browsePath, c]));
  return getRecentBrowseCategoryPaths()
    .map((path) => byPath.get(path))
    .filter((c): c is AmazonBrowseCategory => Boolean(c));
}
