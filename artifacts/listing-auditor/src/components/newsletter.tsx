import { useState } from "react";
import { Mail, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitNewsletterSignup } from "@/lib/newsletter-signup";
import { getEmailValidationError } from "@/lib/email-validation";

export function NewsletterSection({ source = "newsletter-section" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "loading" | "error">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    const validationError = getEmailValidationError(email);
    setEmailError(validationError);
    if (validationError) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      await submitNewsletterSignup(email, source);
      setStatus("success");
      setEmail("");
      setEmailError(null);
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="py-16 md:py-20 bg-slate-900 text-white">
      <div className="max-w-xl mx-auto px-8 text-center">
        <Sparkles className="w-8 h-8 text-orange-400 mx-auto mb-4" />
        <h2 className="text-2xl md:text-3xl font-bold mb-3">Get weekly Amazon selling tips</h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          Join 5,000+ sellers who get actionable listing optimization advice delivered to their inbox.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const value = e.target.value;
                setEmail(value);
                setEmailError(value.trim() ? getEmailValidationError(value) : null);
              }}
              onBlur={() => setEmailError(getEmailValidationError(email))}
              placeholder="your@email.com"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
              aria-invalid={emailError ? true : undefined}
            />
          </div>
          <Button
            type="submit"
            className="shrink-0 px-5"
            disabled={status === "success" || status === "loading" || !!getEmailValidationError(email)}
          >
            {status === "success" ? (
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Subscribed</span>
            ) : (
              "Subscribe"
            )}
          </Button>
        </form>
        {emailError && <p className="text-xs text-red-400 mt-2">{emailError}</p>}
        <p className="text-xs text-slate-500 mt-4">No spam. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}
