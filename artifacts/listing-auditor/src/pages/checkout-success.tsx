import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refetchCreditQueries } from "@/lib/credit-queries";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const activatedRef = useRef(false);

  useEffect(() => {
    if (activatedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("failed");
      setErrorMessage("No session ID found. Please contact support.");
      return;
    }

    let attempts = 0;
    const maxAttempts = 20;

    async function poll() {
      try {
        const res = await fetch(
          `${basePath}/api/stripe/session-status?session_id=${encodeURIComponent(sessionId!)}`,
          { credentials: "include" },
        );
        const data = await res.json() as { status?: string; activated?: boolean; error?: string };

        if (!res.ok) {
          setStatus("failed");
          setErrorMessage(data.error ?? "Payment verification failed.");
          return;
        }

        if (data.status === "paid") {
          activatedRef.current = true;
          setStatus("success");
          queryClient.setQueryData(["user-profile-summary"], (prev: { onboardingCompleted?: boolean } | undefined) => ({
            ...prev,
            onboardingCompleted: true,
          }));
          void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
          void queryClient.invalidateQueries({ queryKey: ["user-profile-summary"] });
          void queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
          void refetchCreditQueries(queryClient);
          setTimeout(() => setLocation("/dashboard"), 2200);
          return;
        }

        if (data.status === "unpaid" && attempts >= 5) {
          setStatus("failed");
          setErrorMessage("Payment was not completed. Please try again or contact support if you were charged.");
          return;
        }

        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1500);
        } else {
          setStatus("failed");
          setErrorMessage("Payment confirmation timed out. If you were charged, please contact support with your order details.");
        }
      } catch {
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setStatus("failed");
          setErrorMessage("Could not verify payment. Please check your email for a Stripe receipt, or contact support.");
        }
      }
    }

    poll();
  }, [setLocation]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">

        {status === "loading" && (
          <>
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Confirming your payment…</h1>
            <p className="text-slate-500 text-sm">Verifying with Stripe. This takes just a moment.</p>
            <div className="mt-6 flex gap-1.5 justify-center">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-orange-300 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-9 h-9 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment confirmed!</h1>
            <p className="text-slate-500 text-sm mb-6">Your subscription is active. Redirecting to your dashboard…</p>
            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full"
                style={{ width: "100%", transition: "width 2.2s linear", animation: "none" }}
              />
            </div>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-9 h-9 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-red-600 mb-6">{errorMessage}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setLocation("/onboarding")}>Try again</Button>
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
