import { useMemo } from "react";
import { SignUp, ClerkLoaded, ClerkLoading } from "@clerk/react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { appendPlanSelectionToPath, coercePlanId } from "@/lib/plan-selection";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Clerk hosted sign-up (handles bot-protection CAPTCHA / Turnstile correctly).
 * Custom email/password flows fail with captcha_invalid when Turnstile cannot load
 * (common on Cloudflare preview tunnels and strict browser extensions).
 */
export default function SignUpPage() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const redirectParam = searchParams.get("redirect_url");
  const email = searchParams.get("email") ?? undefined;
  const planId = coercePlanId(searchParams.get("plan"));
  const billingYearly = searchParams.get("billing") === "yearly";

  const redirectUrl = useMemo(() => {
    if (redirectParam?.startsWith("/")) {
      return `${basePath}${appendPlanSelectionToPath(redirectParam, planId, billingYearly)}`;
    }
    const onboardingPath = appendPlanSelectionToPath("/onboarding", planId, billingYearly);
    return `${basePath}${onboardingPath}`;
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

  const isInviteSignUp = useMemo(() => {
    const redirect = redirectParam ?? "";
    return (
      redirect.includes("accept-invite") ||
      redirect.includes("accept-workspace-invite") ||
      redirect.includes("accept-admin-invite")
    );
  }, [redirectParam]);

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
      <ClerkLoading>
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <p className="text-sm text-slate-600">Loading sign-up…</p>
        </div>
      </ClerkLoading>
      <ClerkLoaded>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={signInUrl}
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
        initialValues={email ? { emailAddress: email } : undefined}
        appearance={clerkAppearance}
      />
      </ClerkLoaded>
      {typeof window !== "undefined" && window.location.hostname.endsWith(".trycloudflare.com") && (
        <p className="mt-4 max-w-[440px] text-center text-[11px] text-slate-500">
          Cloudflare preview: if the form stays blank, ask your admin to set a matching{" "}
          <code className="text-slate-600">CLERK_SECRET_KEY</code> for this Clerk app and restart the dev stack.
          You can also try{" "}
          <Link href={signInPath} className="text-orange-600 font-medium hover:underline">
            Sign in
          </Link>{" "}
          if you already have an account.
        </p>
      )}
    </div>
  );
}
