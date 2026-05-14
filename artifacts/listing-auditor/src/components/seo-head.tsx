import { useEffect } from "react";

interface SeoHeadProps {
  title: string;
  description: string;
}

export function SeoHead({ title, description }: SeoHeadProps) {
  useEffect(() => {
    document.title = title + " — ListingAuditor";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", description);
    }
  }, [title, description]);

  return null;
}
