import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useHomepageCmsContext } from "@/components/homepage-cms-context";
import { cmsText } from "@/lib/homepage-cms";
import { mapPublicFaqs, usePublicFaqs } from "@/lib/public-faqs";
import { getEmailValidationError } from "@/lib/email-validation";
import { useToast } from "@/hooks/use-toast";
import { LANDING_SECTION_CLASS, LANDING_SECTION_PAD } from "@/lib/landing-layout";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PUBLIC_DATA_STALE_MS = 5 * 60_000;

export function LandingFaqProposalSection() {
  const cms = useHomepageCmsContext();
  const { toast } = useToast();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const headingLead = cmsText(cms, "faq.heading_lead") || "Frequently Asked";
  const headingAccent = cmsText(cms, "faq.heading_accent") || "Questions";
  const formTitle = cmsText(cms, "faq.form_title");
  const submitLabel = cmsText(cms, "faq.form_submit_text") || "Get your free proposal";
  const consentLabel =
    cmsText(cms, "faq.form_consent_text") ||
    "I consent to receive notifications and promotional messages";

  const { data: dbFaqs = [] } = usePublicFaqs(PUBLIC_DATA_STALE_MS);
  const faqs = mapPublicFaqs(dbFaqs);

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    website: "",
    email: "",
    phone: "",
    message: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (name === "email") {
      setEmailError(value.trim() ? getEmailValidationError(value) : null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    const nextEmailError = getEmailValidationError(form.email);
    setEmailError(nextEmailError);
    if (nextEmailError) return;

    if (!consent) {
      setSubmitError("Please accept the consent checkbox to continue.");
      return;
    }

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const company = form.company.trim();
    const website = form.website.trim();
    const message = form.message.trim();

    if (!firstName || !lastName || !company || !website || !message) {
      setSubmitError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "enterprise",
          email: form.email.trim(),
          name: `${firstName} ${lastName}`.trim(),
          data: {
            subject: "Free proposal request",
            message,
            company,
            website,
            phone: form.phone.trim(),
            firstName,
            lastName,
            marketingConsent: "true",
            source: "homepage_faq",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : "Failed to submit");
      }
      setSubmitted(true);
    } catch (err) {
      const description = err instanceof Error ? err.message : "Failed to submit";
      setSubmitError(description);
      toast({ title: "Could not send request", description, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (faqs.length === 0) return null;

  return (
    <section
      className={cn(
        "pt-10 pb-14 sm:pt-14 sm:pb-20 lg:pb-24 bg-gradient-to-b from-slate-50/90 to-white border-t border-slate-100",
        LANDING_SECTION_PAD,
      )}
    >
      <div className={cn(LANDING_SECTION_CLASS, "max-w-6xl")}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 xl:gap-16 items-start">
          {/* FAQ column */}
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-6 sm:mb-8 text-slate-900">
              {headingLead}{" "}
              <span className="text-orange-500">{headingAccent}</span>
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

          {/* Proposal form */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-lg shadow-slate-200/50 lg:sticky lg:top-24">
            {formTitle && (
              <p className="text-sm font-semibold text-slate-700 mb-4">{formTitle}</p>
            )}

            {submitted ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-orange-500 mb-3" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">Request received</h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  Our team will review your details and reach out with a tailored proposal.
                </p>
                <Button
                  variant="outline"
                  className="mt-5 border-orange-200 text-orange-700 hover:bg-orange-50"
                  onClick={() => {
                    setSubmitted(false);
                    setConsent(false);
                    setForm({
                      firstName: "",
                      lastName: "",
                      company: "",
                      website: "",
                      email: "",
                      phone: "",
                      message: "",
                    });
                  }}
                >
                  Submit another request
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="faq-firstName" className="text-xs text-slate-600">
                      First name *
                    </Label>
                    <Input
                      id="faq-firstName"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      required
                      className="mt-1 border-slate-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="faq-lastName" className="text-xs text-slate-600">
                      Last name *
                    </Label>
                    <Input
                      id="faq-lastName"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      required
                      className="mt-1 border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="faq-company" className="text-xs text-slate-600">
                      Company / organization *
                    </Label>
                    <Input
                      id="faq-company"
                      name="company"
                      value={form.company}
                      onChange={handleChange}
                      required
                      className="mt-1 border-slate-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="faq-website" className="text-xs text-slate-600">
                      Website *
                    </Label>
                    <Input
                      id="faq-website"
                      name="website"
                      type="url"
                      value={form.website}
                      onChange={handleChange}
                      placeholder="https://"
                      required
                      className="mt-1 border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="faq-email" className="text-xs text-slate-600">
                      Email address *
                    </Label>
                    <Input
                      id="faq-email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      onBlur={() => setEmailError(getEmailValidationError(form.email))}
                      required
                      aria-invalid={emailError ? true : undefined}
                      className="mt-1 border-slate-200"
                    />
                    {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
                  </div>
                  <div>
                    <Label htmlFor="faq-phone" className="text-xs text-slate-600">
                      Phone
                    </Label>
                    <Input
                      id="faq-phone"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="mt-1 border-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="faq-message" className="text-xs text-slate-600">
                    Tell us about your business *
                  </Label>
                  <Textarea
                    id="faq-message"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={4}
                    required
                    placeholder="Catalog size, marketplaces, goals…"
                    className="mt-1 border-slate-200 resize-none"
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <Checkbox
                    checked={consent}
                    onCheckedChange={(v) => setConsent(v === true)}
                    className="mt-0.5 border-slate-300 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <span className="text-xs text-slate-600 leading-snug group-hover:text-slate-800">
                    {consentLabel}
                  </span>
                </label>

                {submitError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {submitError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading || !!getEmailValidationError(form.email)}
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide text-sm"
                >
                  {loading ? "Sending…" : submitLabel}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
