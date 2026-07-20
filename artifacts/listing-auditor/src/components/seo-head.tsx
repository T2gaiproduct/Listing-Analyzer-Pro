import { useEffect } from "react";
import { useBranding } from "@/hooks/use-branding";

interface SeoHeadProps {
  title: string;
  description: string;
}

export function SeoHead({ title, description }: SeoHeadProps) {
  const { platformName } = useBranding();

  useEffect(() => {
    document.title = `${title} — ${platformName}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", description);
    }
  }, [title, description, platformName]);

  return null;
}
