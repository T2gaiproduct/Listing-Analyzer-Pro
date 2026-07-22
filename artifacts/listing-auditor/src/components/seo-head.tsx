import { useEffect } from "react";
import { useBranding } from "@/hooks/use-branding";
import type { PageSeoData } from "@/hooks/use-page-seo";

const SCHEMA_SCRIPT_ID = "page-schema-jsonld";

interface SeoHeadProps {
  title: string;
  description: string;
  seo?: Pick<
    PageSeoData,
    "metaTitle" | "metaDescription" | "keywords" | "ogTitle" | "ogDescription" | "ogImage" | "schemaMarkup"
  >;
}

function upsertMeta(attr: "name" | "property", key: string, content: string | null | undefined) {
  if (!content?.trim()) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content.trim());
}

export function SeoHead({ title, description, seo }: SeoHeadProps) {
  const { platformName } = useBranding();

  const documentTitle = seo?.metaTitle?.trim() || `${title} — ${platformName}`;
  const metaDescription = seo?.metaDescription?.trim() || description;
  const ogTitle = seo?.ogTitle?.trim() || seo?.metaTitle?.trim() || documentTitle;
  const ogDescription = seo?.ogDescription?.trim() || metaDescription;
  const ogImage = seo?.ogImage?.trim() || "";
  const schemaMarkup = seo?.schemaMarkup?.trim() || "";

  useEffect(() => {
    document.title = documentTitle;
    upsertMeta("name", "description", metaDescription);
    upsertMeta("name", "keywords", seo?.keywords);
    upsertMeta("property", "og:title", ogTitle);
    upsertMeta("property", "og:description", ogDescription);
    upsertMeta("property", "og:type", "website");
    if (ogImage) upsertMeta("property", "og:image", ogImage);
    upsertMeta("name", "twitter:card", ogImage ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", ogTitle);
    upsertMeta("name", "twitter:description", ogDescription);
    if (ogImage) upsertMeta("name", "twitter:image", ogImage);

    const existing = document.getElementById(SCHEMA_SCRIPT_ID);
    existing?.remove();

    if (schemaMarkup) {
      try {
        JSON.parse(schemaMarkup);
        const script = document.createElement("script");
        script.id = SCHEMA_SCRIPT_ID;
        script.type = "application/ld+json";
        script.textContent = schemaMarkup;
        document.head.appendChild(script);
      } catch {
        /* ignore invalid JSON-LD from admin */
      }
    }

    return () => {
      document.getElementById(SCHEMA_SCRIPT_ID)?.remove();
    };
  }, [documentTitle, metaDescription, ogTitle, ogDescription, ogImage, schemaMarkup, seo?.keywords]);

  return null;
}
