import { useQuery } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface PageSeoData {
  pageSlug: string;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  schemaMarkup: string | null;
}

export function usePageSeo(pageSlug: string) {
  return useQuery<PageSeoData | null>({
    queryKey: ["page-seo", pageSlug],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/seo/${encodeURIComponent(pageSlug)}`);
      if (!r.ok) throw new Error("Failed to load SEO settings");
      const data = await r.json() as PageSeoData;
      const hasValues = Boolean(
        data.metaTitle?.trim()
        || data.metaDescription?.trim()
        || data.keywords?.trim()
        || data.ogTitle?.trim()
        || data.ogDescription?.trim()
        || data.ogImage?.trim()
        || data.schemaMarkup?.trim(),
      );
      return hasValues ? data : null;
    },
    staleTime: 60_000,
  });
}
