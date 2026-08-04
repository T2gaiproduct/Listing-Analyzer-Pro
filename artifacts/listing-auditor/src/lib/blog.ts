export interface PublicBlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featuredImage: string | null;
  status: string;
  publishedAt: string | null;
  category: string | null;
  tags: string[] | null;
  author: string | null;
  readMinutes: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
}

export function formatBlogDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatReadTime(minutes: number | null | undefined): string {
  const mins = minutes && minutes > 0 ? minutes : 5;
  return `${mins} min`;
}

/** Resolve uploaded `/api/images/blog/...` paths and external URLs for display. */
export function resolveBlogImageUrl(path: string | null | undefined, basePath = ""): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = basePath.replace(/\/$/, "");
  if (base && !normalized.startsWith(base)) {
    return `${base}${normalized}`;
  }
  return normalized;
}
