import { X, Tag } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { usePromoAnnouncement } from "@/hooks/use-promo-announcement";

export function PromoBanner() {
  const { promo } = usePromoAnnouncement();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("listingauditor-promo") === "dismissed";
    } catch {
      return false;
    }
  });

  if (!promo.enabled || dismissed) return null;

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
          <strong className="text-orange-400">{promo.text}</strong>{" "}
          <code className="bg-orange-500/20 text-orange-300 px-1 py-0.5 sm:px-1.5 sm:py-0.5 rounded font-mono text-[10px] sm:text-xs">
            {promo.code}
          </code>
        </span>
        {promo.linkText && promo.linkUrl && (
          <Link
            href={promo.linkUrl}
            className="hidden sm:inline underline underline-offset-2 text-orange-300 hover:text-orange-200 transition-colors shrink-0"
          >
            {promo.linkText}
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
