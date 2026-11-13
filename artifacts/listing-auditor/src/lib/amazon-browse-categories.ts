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

function splitSearchWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s&/|,-]+/)
    .map((w) => w.replace(/[^\w]/g, ""))
    .filter(Boolean);
}

/** Match a query token to a single word (avoids e.g. "car" matching inside "card"). */
export function browseCategoryTokenMatchesWord(word: string, token: string): boolean {
  const w = word.toLowerCase();
  const t = token.toLowerCase();
  if (!w || !t) return false;
  if (w === t) return true;
  if (!w.startsWith(t)) return false;
  if (w.length === t.length) return true;

  const remainder = w.slice(t.length);
  if (/^(?:s|es|'s)$/i.test(remainder)) return true;
  if (remainder.length >= 2) return true;
  if (remainder.length === 1 && /[aeiou]/i.test(remainder)) return true;
  return false;
}

function tokenMatchScore(category: AmazonBrowseCategory, token: string): number {
  const labelWords = splitSearchWords(category.label);
  for (const word of labelWords) {
    if (word === token) return 100;
    if (browseCategoryTokenMatchesWord(word, token)) return 90;
  }

  const segments = browsePathSegments(category.browsePath);
  for (const segment of segments) {
    const segWords = splitSearchWords(segment);
    for (const word of segWords) {
      if (word === token) return 70;
      if (browseCategoryTokenMatchesWord(word, token)) return 60;
    }
  }

  if (token.length >= 4) {
    const hay = `${category.label} ${category.browsePath}`.toLowerCase();
    if (hay.includes(token)) return 20;
  }

  return 0;
}

export function filterAmazonBrowseCategories(
  categories: readonly AmazonBrowseCategory[],
  search: string,
  limit = MAX_SEARCH_RESULTS,
): AmazonBrowseCategory[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...categories].slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = categories
    .map((c) => {
      const perToken = tokens.map((t) => tokenMatchScore(c, t));
      if (perToken.some((s) => s === 0)) return null;
      const score = perToken.reduce((sum, s) => sum + s, 0);
      return { category: c, score };
    })
    .filter((row): row is { category: AmazonBrowseCategory; score: number } => row != null);

  scored.sort((a, b) => b.score - a.score || a.category.label.localeCompare(b.category.label));

  return scored.slice(0, limit).map((row) => row.category);
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
