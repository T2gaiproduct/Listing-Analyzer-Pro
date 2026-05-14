import { X, Tag } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export function PromoBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("listingauditor-promo") === "dismissed";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("listingauditor-promo", "dismissed");
    } catch {}
  };

  return (
    <div className="bg-slate-900 text-white text-sm py-2.5 px-4 text-center relative">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Tag className="w-3.5 h-3.5 text-orange-400" />
        <span>
          <strong className="text-orange-400">Launch offer:</strong> Get 20% off any plan with code{" "}
          <code className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-mono text-xs">LAUNCH20</code>
        </span>
        <Link
          href="/pricing"
          className="underline underline-offset-2 text-orange-300 hover:text-orange-200 transition-colors ml-1"
        >
          See pricing
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
