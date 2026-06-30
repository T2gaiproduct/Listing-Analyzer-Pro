import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Upload,
  FileText,
  Image,
  Download,
  Sparkles,
} from "lucide-react";

const steps = [
  {
    number: "1",
    icon: Upload,
    title: "Upload Product Information",
    desc: "Upload product data or click the picture",
    gradient: "from-orange-100 to-orange-50",
    iconColor: "text-orange-500",
    border: "border-b-orange-400",
  },
  {
    number: "2",
    icon: FileText,
    title: "Listing",
    desc: "AI generates compelling product titles, bullets & descriptions",
    gradient: "from-amber-100 to-amber-50",
    iconColor: "text-amber-600",
    border: "border-b-amber-400",
  },
  {
    number: "3",
    icon: Image,
    title: "Graphics",
    desc: "Create stunning product images and infographics",
    gradient: "from-orange-100 to-rose-50",
    iconColor: "text-rose-500",
    border: "border-b-rose-400",
  },
  {
    number: "4",
    icon: Sparkles,
    title: "A+ Content",
    desc: "Generate professional A+ content to boost conversions",
    gradient: "from-amber-50 to-orange-50",
    iconColor: "text-orange-600",
    border: "border-b-orange-500",
  },
  {
    number: "5",
    icon: Download,
    title: "Export",
    desc: "Export and publish your listing to your store",
    gradient: "from-orange-50 to-amber-50",
    iconColor: "text-amber-500",
    border: "border-b-amber-500",
  },
];

const platforms = [
  { name: "Shopify", emoji: "🛍️" },
  { name: "Walmart", emoji: "🛒" },
  { name: "eBay", emoji: "🏷️" },
  { name: "+ More Platforms", emoji: "📦" },
];

export default function AuditNew() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-full animate-in fade-in duration-500">
      {/* Hero */}
      <div
        className="text-center pt-12 pb-10 px-6 relative overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 10% 0%, rgba(251,191,100,0.18) 0%, transparent 55%), radial-gradient(ellipse at 90% 5%, rgba(255,237,213,0.3) 0%, transparent 50%), #fff",
        }}
      >
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Create Product Listings
        </h1>
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mt-1">
          <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
            Using AI
          </span>{" "}
          <Sparkles className="inline w-8 h-8 text-orange-400 align-middle -mt-1" />
        </h2>
        <p className="text-base text-slate-500 mt-4 max-w-md mx-auto">
          Turn product information into high-converting listings in minutes.
        </p>

        <Button
          size="lg"
          className="mt-7 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-10 py-6 rounded-full shadow-lg shadow-orange-400/30 text-base font-semibold"
          onClick={() => setLocation("/audits/workflow")}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Start Generating
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>

        <p className="text-xs text-slate-400 mt-4">
          Works with{" "}
          <span className="text-orange-500 font-medium">Shopify</span>,{" "}
          <span className="text-orange-500 font-medium">Walmart</span>,{" "}
          <span className="text-orange-500 font-medium">eBay</span>, and most
          product pages
        </p>
      </div>

      {/* How It Works */}
      <div className="px-4 sm:px-6 pb-10 max-w-5xl mx-auto">
        {/* Section header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-1">
            <span className="text-orange-300 text-base">✦</span>
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-orange-300" />
          </div>
          <span className="text-xs font-bold text-orange-500 uppercase tracking-[0.2em]">
            How It Works
          </span>
          <div className="flex items-center gap-1">
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-orange-300" />
            <span className="text-orange-300 text-base">✦</span>
          </div>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-0 relative">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative flex items-stretch">
                {/* Card */}
                <div
                  className={`flex-1 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center text-center gap-4 shadow-sm hover:shadow-md transition-shadow border-b-4 ${step.border}`}
                >
                  {/* Step number badge */}
                  <div className="self-start">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                      {step.number}
                    </span>
                  </div>

                  {/* Icon circle */}
                  <div
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-inner`}
                  >
                    <Icon className={`w-7 h-7 ${step.iconColor}`} />
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800 leading-snug">
                      {step.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>

                {/* Dashed arrow connector */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-16 -right-4 z-10 items-center justify-center w-8">
                    <svg
                      width="32"
                      height="16"
                      viewBox="0 0 32 16"
                      fill="none"
                      className="text-orange-300"
                    >
                      <path
                        d="M0 8 Q8 8 16 8 Q24 8 28 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        strokeLinecap="round"
                      />
                      <polyline
                        points="25,4 30,8 25,12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Platform logos row */}
        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          {platforms.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm text-slate-600 font-medium"
            >
              <span className="text-base">{p.emoji}</span>
              {p.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
