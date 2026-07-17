import { useEffect } from "react";
import { useBranding } from "@/hooks/use-branding";

function faviconType(url: string) {
  if (url.includes("image/svg") || url.endsWith(".svg")) return "image/svg+xml";
  if (url.includes("image/png") || url.endsWith(".png")) return "image/png";
  if (url.includes("image/x-icon") || url.endsWith(".ico")) return "image/x-icon";
  if (url.includes("image/webp") || url.endsWith(".webp")) return "image/webp";
  return undefined;
}

export function BrandingHead() {
  const { faviconUrl } = useBranding();

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
    const type = faviconType(faviconUrl);
    if (type) link.type = type;
    else link.removeAttribute("type");
  }, [faviconUrl]);

  return null;
}
