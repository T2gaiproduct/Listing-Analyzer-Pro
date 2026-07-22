import { SeoHead } from "@/components/seo-head";
import { usePageSeo } from "@/hooks/use-page-seo";

interface PageSeoProps {
  pageSlug: string;
  title: string;
  description: string;
}

/** Renders document meta tags from admin SEO settings with page fallbacks. */
export function PageSeo({ pageSlug, title, description }: PageSeoProps) {
  const { data: seo } = usePageSeo(pageSlug);
  return <SeoHead title={title} description={description} seo={seo ?? undefined} />;
}
