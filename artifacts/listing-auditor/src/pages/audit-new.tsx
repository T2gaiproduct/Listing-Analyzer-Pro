import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  BuildBrandStartDrawer,
  type BuildBrandStartEntry,
} from "@/components/build-brand-start-drawer";
import { HERO_PRIMARY_CTA_CLASS } from "@/lib/hero-primary-cta";
import { cn } from "@/lib/utils";
import { clearAuditListingWorkflowIntent } from "@/lib/audit-listing-workflow";
import { clearCreateGraphicsWorkflowIntent } from "@/lib/create-graphics-workflow";
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

export default function AuditNew() {
  const [, setLocation] = useLocation();
  const [startDrawerOpen, setStartDrawerOpen] = useState(false);

  function handleStartChoice(entry: BuildBrandStartEntry) {
    setStartDrawerOpen(false);
    if (entry === "import-link") {
      setLocation("/audits/import-from-link");
      return;
    }
    clearAuditListingWorkflowIntent();
    clearCreateGraphicsWorkflowIntent();
    setLocation(`/audits/workflow?entry=${entry}`);
  }

  return (
    <div className="min-h-full animate-in fade-in duration-500">
      {/* Hero */}
      <div className="text-center pt-8 pb-6 px-4 sm:pt-12 sm:pb-10 sm:px-6 relative overflow-hidden bg-card border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-100 dark:opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 10% 0%, rgba(251,191,100,0.18) 0%, transparent 55%), radial-gradient(ellipse at 90% 5%, rgba(255,237,213,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative">
        <h1 className="text-[1.65rem] sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
          Build Your Brand Content
        </h1>
        <h2 className="text-[1.65rem] sm:text-5xl font-extrabold tracking-tight leading-tight mt-1">
          <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
            Using AI
          </span>{" "}
          <Sparkles className="inline w-6 h-6 sm:w-8 sm:h-8 text-orange-400 align-middle -mt-0.5 sm:-mt-1" />
        </h2>
        <p className="text-[11px] text-muted-foreground sm:text-foreground mt-3 sm:mt-4 max-w-md mx-auto leading-relaxed px-1">
          Turn product information into high-converting listings in minutes.
        </p>

        <Button
          size="lg"
          className={cn(
            "mt-5 sm:mt-7 w-full max-w-sm mx-auto sm:w-auto sm:max-w-none max-sm:min-w-0 max-sm:py-3.5 max-sm:px-6",
            HERO_PRIMARY_CTA_CLASS,
          )}
          onClick={() => setStartDrawerOpen(true)}
        >
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
          Start Generating
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 shrink-0" />
        </Button>
        <BuildBrandStartDrawer
          open={startDrawerOpen}
          onOpenChange={setStartDrawerOpen}
          onChoose={handleStartChoice}
        />
        </div>
      </div>

      {/* How It Works */}
      <div className="pb-8 sm:pb-10 w-full min-w-0 px-4 sm:px-6 max-w-6xl mx-auto">
        {/* Section header */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-5 sm:mb-8">
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-orange-300 text-sm sm:text-base">✦</span>
            <div className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-orange-300" />
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-orange-500 uppercase tracking-[0.15em] sm:tracking-[0.2em]">
            How It Works
          </span>
          <div className="hidden sm:flex items-center gap-1">
            <div className="h-px w-8 sm:w-12 bg-gradient-to-l from-transparent to-orange-300" />
            <span className="text-orange-300 text-sm sm:text-base">✦</span>
          </div>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-0 relative">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative flex items-stretch min-w-0">
                {/* Card — mobile: compact horizontal row; sm+: centered column */}
                <div
                  className={cn(
                    "flex-1 min-w-0 bg-card border border-border rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-shadow",
                    "max-sm:flex max-sm:flex-row max-sm:items-center max-sm:gap-3 max-sm:p-3 max-sm:text-left max-sm:border-b-2",
                    "sm:flex sm:flex-col sm:items-center sm:text-center sm:gap-4 sm:p-5 sm:border-b-4",
                    step.border,
                  )}
                >
                  <div className="hidden sm:block self-start">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold">
                      {step.number}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "rounded-full bg-gradient-to-br flex items-center justify-center shadow-inner shrink-0",
                      step.gradient,
                      "w-11 h-11 sm:w-16 sm:h-16",
                    )}
                  >
                    <Icon className={cn(step.iconColor, "w-5 h-5 sm:w-7 sm:h-7")} />
                  </div>

                  <div className="flex-1 min-w-0 max-sm:py-0.5">
                    <p className="text-[13px] sm:text-sm font-bold text-foreground leading-snug">
                      <span className="sm:hidden text-muted-foreground font-semibold mr-1.5 tabular-nums">
                        {step.number}.
                      </span>
                      {step.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground sm:text-foreground mt-0.5 sm:mt-1.5 leading-snug sm:leading-relaxed line-clamp-2 sm:line-clamp-none">
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
      </div>
    </div>
  );
}
