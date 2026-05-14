import { useEffect, useState, useCallback } from "react";
import { X, Gift, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export function ExitPopup() {
  const [show, setShow] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    if (e.clientY < 10 && !hasShown) {
      setShow(true);
      setHasShown(true);
      try {
        localStorage.setItem("listingauditor-exit-popup", "shown");
      } catch {}
    }
  }, [hasShown]);

  useEffect(() => {
    try {
      if (localStorage.getItem("listingauditor-exit-popup") === "shown") {
        setHasShown(true);
      }
    } catch {}

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [handleMouseLeave]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={() => setShow(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
          <Gift className="w-6 h-6 text-orange-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Wait! Get 20% off your first month</h3>
        <p className="text-slate-500 mb-6 leading-relaxed">
          Start optimizing your Amazon listings today with AI-powered audits. Use code <strong className="text-slate-900">FIRST20</strong> at checkout.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/sign-up"
            onClick={() => setShow(false)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors"
          >
            Claim your discount <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={() => setShow(false)}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            No thanks, I&apos;ll pass
          </button>
        </div>
      </div>
    </div>
  );
}
