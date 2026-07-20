import { X, Tag } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { cmsEnabled, cmsText } from "@/lib/homepage-cms";
import { useHomepageCmsContext } from "@/components/homepage-cms-context";

export function PromoBanner() {
  const cms = useHomepageCmsContext();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("listingauditor-promo") === "dismissed";
    } catch {
      return false;
    }
  });

  if (!cmsEnabled(cms, "promo") || dismissed) return null;

  const promoText = cmsText(cms, "promo.text");
  const promoCode = cmsText(cms, "promo.code");
  const linkText = cmsText(cms, "promo.link_text");
  const linkUrl = cmsText(cms, "promo.link_url");

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("listingauditor-promo", "dismissed");
    } catch {}
  };

  return (
    <div className="hidden sm:block bg-slate-900 text-white text-[11px] sm:text-sm py-1.5 sm:py-2.5 px-3 sm:px-6 relative">
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 pr-7 sm:pr-10 whitespace-nowrap overflow-hidden">
        <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 shrink-0" />
        <span className="truncate">
          <strong className="text-orange-400">{promoText}</strong>{" "}
          <code className="bg-orange-500/20 text-orange-300 px-1 py-0.5 sm:px-1.5 sm:py-0.5 rounded font-mono text-[10px] sm:text-xs">
            {promoCode}
          </code>
        </span>
        {linkText && linkUrl && (
          <Link
            href={linkUrl}
            className="hidden sm:inline underline underline-offset-2 text-orange-300 hover:text-orange-200 transition-colors shrink-0"
          >
            {linkText}
          </Link>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors touch-target flex items-center justify-center"
        aria-label="Dismiss promo"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
