import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useHomepageCmsContext } from "@/components/homepage-cms-context";
import { cmsText } from "@/lib/homepage-cms";
import { mapPublicFaqs, usePublicFaqs } from "@/lib/public-faqs";
import { LANDING_SECTION_CLASS, LANDING_SECTION_PAD } from "@/lib/landing-layout";
import { cn } from "@/lib/utils";

const PUBLIC_DATA_STALE_MS = 5 * 60_000;

export function LandingFaqProposalSection() {
  const cms = useHomepageCmsContext();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const headingLead = cmsText(cms, "faq.heading_lead") || "Frequently Asked";
  const headingAccent = cmsText(cms, "faq.heading_accent") || "Questions";
  const legacyHeading = cmsText(cms, "faq.heading");

  const { data: dbFaqs = [] } = usePublicFaqs(PUBLIC_DATA_STALE_MS);
  const faqs = mapPublicFaqs(dbFaqs);

  if (faqs.length === 0) return null;

  return (
    <section
      className={cn(
        "pt-10 pb-14 sm:pt-14 sm:pb-20 lg:pb-24 bg-gradient-to-b from-slate-50/90 to-white border-t border-slate-100",
        LANDING_SECTION_PAD,
      )}
    >
      <div className={cn(LANDING_SECTION_CLASS, "max-w-4xl mx-auto")}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-6 sm:mb-8 text-slate-900 text-center">
          {legacyHeading && legacyHeading !== "Frequently Asked Questions" ? (
            legacyHeading
          ) : (
            <>
              {headingLead}{" "}
              <span className="text-orange-500">{headingAccent}</span>
            </>
          )}
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={faq.id}
                className={cn(
                  "rounded-xl border bg-white shadow-sm transition-colors",
                  isOpen ? "border-orange-200" : "border-slate-200/90 hover:border-orange-100",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-start justify-between gap-4 px-4 sm:px-5 py-4 text-left",
                    isOpen && "bg-orange-50/40",
                  )}
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 pr-2",
                      isOpen && "text-slate-900",
                    )}
                  >
                    {faq.q}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-orange-400/80 shrink-0 mt-0.5" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-orange-100/80 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
