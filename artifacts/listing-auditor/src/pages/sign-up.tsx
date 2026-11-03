import { useEffect, useMemo, useState } from "react";
import { SignUp, useAuth } from "@clerk/react";
import { Link } from "wouter";
import { ExternalLink, Loader2 } from "lucide-react";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { appendPlanSelectionToPath, coercePlanId } from "@/lib/plan-selection";
import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PRODUCTION_SIGN_UP = "https://sellerlens.io/sign-up";

/**
 * Clerk hosted sign-up (handles bot-protection CAPTCHA / Turnstile correctly).
 * Custom email/password flows fail with captcha_invalid when Turnstile cannot load
 * (common on Cloudflare preview tunnels and strict browser extensions).
 */
export default function SignUpPage() {
  const { isLoaded: clerkLoaded } = useAuth();
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const onPreview = isCloudflareQuickPreviewHost();

  useEffect(() => {
    if (clerkLoaded) {
      setLoadTimedOut(false);
      return;
    }
    const t = window.setTimeout(() => setLoadTimedOut(true), 12_000);
    return () => window.clearTimeout(t);
  }, [clerkLoaded]);

  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const redirectParam = searchParams.get("redirect_url");
  const email = searchParams.get("email") ?? undefined;
  const planId = coercePlanId(searchParams.get("plan"));
  const billingYearly = searchParams.get("billing") === "yearly";

  const redirectUrl = useMemo(() => {
    if (redirectParam?.startsWith("/")) {
      return `${basePath}${appendPlanSelectionToPath(redirectParam, planId, billingYearly)}`;
    }
    if (planId !== null || billingYearly) {
      return `${basePath}${appendPlanSelectionToPath("/onboarding", planId, billingYearly)}`;
    }
    return `${basePath}/dashboard`;
  }, [redirectParam, planId, billingYearly]);

  const signInPath = useMemo(() => {
    const qs = new URLSearchParams();
    if (redirectParam) qs.set("redirect_url", redirectParam);
    if (email) qs.set("email", email);
    if (planId !== null) qs.set("plan", String(planId));
    if (billingYearly) qs.set("billing", "yearly");
    const query = qs.toString();
    return query ? `/sign-in?${query}` : "/sign-in";
  }, [redirectParam, email, planId, billingYearly]);

  const signInUrl = `${basePath}${signInPath}`;

  const productionSignUpHref = useMemo(() => {
    const qs = new URLSearchParams();
    if (redirectParam?.startsWith("/")) {
      qs.set(
        "redirect_url",
        `${window.location.origin}${basePath}${appendPlanSelectionToPath(redirectParam, planId, billingYearly)}`,
      );
    }
    if (email) qs.set("email", email);
    const q = qs.toString();
    return q ? `${PRODUCTION_SIGN_UP}?${q}` : PRODUCTION_SIGN_UP;
  }, [redirectParam, email, planId, billingYearly]);

  const isInviteSignUp = useMemo(() => {
    const redirect = redirectParam ?? "";
    return (
      redirect.includes("accept-invite")
      || redirect.includes("accept-workspace-invite")
      || redirect.includes("accept-admin-invite")
    );
  }, [redirectParam]);

  const showClerkSpinner = !clerkLoaded && !loadTimedOut;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-10">
      {isInviteSignUp && email && (
        <div className="w-full max-w-[440px] mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <p className="font-semibold">Workspace invitation</p>
          <p className="mt-1 text-orange-800/90">
            Sign up with <span className="font-medium">{email}</span> to accept your invite.
            Already have an account?{" "}
            <Link href={signInPath} className="font-semibold underline">
              Sign in instead
            </Link>
          </p>
        </div>
      )}

      {onPreview && (
        <div className="w-full max-w-[440px] mb-4 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-xs text-slate-600">
          Cloudflare preview: if sign-up does not appear, create your account on{" "}
          <a
            href={productionSignUpHref}
            className="font-medium text-orange-600 hover:underline inline-flex items-center gap-0.5"
            target="_blank"
            rel="noreferrer"
          >
            sellerlens.io
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          , then{" "}
          <Link href={signInPath} className="font-medium text-orange-600 hover:underline">
            sign in here
          </Link>
          .
        </div>
      )}

      {showClerkSpinner && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" aria-hidden />
          <p className="text-sm text-slate-600">Loading sign-up…</p>
        </div>
      )}

      {loadTimedOut && !clerkLoaded && (
        <div className="w-full max-w-[440px] mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 space-y-3">
          <p className="font-semibold">Sign-up is taking too long on this preview link</p>
          <p className="text-amber-900/90">
            Clerk CAPTCHA and bot protection often fail on random <code className="text-xs">trycloudflare.com</code>{" "}
            URLs. Use a stable preview hostname or create your account on production, then sign in on this link.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={productionSignUpHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700"
            >
              Create account on sellerlens.io
            </a>
            <Link
              href={signInPath}
              className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              Sign in on preview
            </Link>
          </div>
        </div>
      )}

      {(clerkLoaded || loadTimedOut) && (
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={signInUrl}
          fallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
          initialValues={email ? { emailAddress: email } : undefined}
          appearance={clerkAppearance}
        />
      )}
    </div>
  );
}
