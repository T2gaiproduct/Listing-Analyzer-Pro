import { useState } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";

const stores = [
  { label: "Amazon", letter: "A", color: "bg-orange-500" },
  { label: "Shopify", letter: "S", color: "bg-green-600" },
  { label: "Walmart", letter: "W", color: "bg-blue-600" },
  { label: "eBay", letter: "e", color: "bg-red-500" },
  { label: "Etsy", letter: "E", color: "bg-orange-400" },
];

const features = [
  {
    title: "Listing Score",
    desc: "Overall quality rating 1–100",
  },
  {
    title: "Top Fixes",
    desc: "Highest-impact improvements",
  },
  {
    title: "Competitor Intel",
    desc: "Benchmark against top sellers",
  },
  {
    title: "Action Plan",
    desc: "Step-by-step improvement roadmap",
  },
];

export default function AuditListings() {
  const [url, setUrl] = useState("");
  const [, navigate] = useLocation();

  function handleAnalyze() {
    if (!url.trim()) return;
    const encoded = encodeURIComponent(url.trim());
    navigate(`/audits/new?url=${encoded}`);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 py-16">
      {/* Heading */}
      <h1 className="text-4xl font-bold text-foreground text-center tracking-tight mb-3">
        Analyze your listing
      </h1>
      <p className="text-muted-foreground text-center text-base mb-10">
        Paste any product page URL for an instant AI audit
      </p>

      {/* URL input */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="Paste any product page URL..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none min-w-0"
          />
          <button
            onClick={handleAnalyze}
            className="flex-shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
          >
            Analyze
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Works with Amazon, Shopify, Walmart, eBay, and most product pages
        </p>
      </div>

      {/* Works with any store */}
      <div className="mt-14 w-full max-w-2xl">
        <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">
          Works with any store
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {stores.map(({ label, letter, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 border border-border rounded-lg px-4 py-2 bg-card text-sm font-medium text-foreground"
            >
              <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold ${color}`}>
                {letter}
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* What you get */}
      <div className="mt-14 w-full max-w-2xl">
        <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">
          What you get
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {features.map(({ title, desc }) => (
            <div
              key={title}
              className="bg-card border border-border rounded-xl px-4 py-5 text-center"
            >
              <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
