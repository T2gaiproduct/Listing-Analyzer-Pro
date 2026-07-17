import { MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const isPublicPage = ["/", "/features", "/pricing", "/about", "/blog", "/tutorials", "/contact", "/help", "/enterprise", "/terms", "/privacy"].some((p) =>
    window.location.pathname.endsWith(p) || window.location.pathname === p
  );
  if (!isPublicPage) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label="Open chat"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-slate-900 text-white p-4">
            <h3 className="font-semibold text-sm">Need help?</h3>
            <p className="text-xs text-slate-400 mt-0.5">Our team typically responds within a few hours.</p>
          </div>
          <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
              Hi there! How can we help you with your Amazon listings today?
            </div>
            <div className="space-y-2">
              <Link
                href="/help"
                onClick={() => setOpen(false)}
                className="block w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-orange-50 text-sm text-slate-700 hover:text-orange-700 transition-colors"
              >
                Browse Help Center
              </Link>
              <Link
                href="/tutorials"
                onClick={() => setOpen(false)}
                className="block w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-orange-50 text-sm text-slate-700 hover:text-orange-700 transition-colors"
              >
                Watch Tutorials
              </Link>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="block w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-orange-50 text-sm text-slate-700 hover:text-orange-700 transition-colors"
              >
                Send us an email
              </Link>
            </div>
          </div>
          <div className="p-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400 text-center">
              Live chat coming soon — contact us via email for now.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
