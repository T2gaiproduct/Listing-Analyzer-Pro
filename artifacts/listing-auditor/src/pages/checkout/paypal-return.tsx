import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refetchCreditQueries } from "@/lib/credit-queries";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function clearPayPalLocalStorage() {
  localStorage.removeItem("paypal_order_id");
  localStorage.removeItem("paypal_plan_id");
  localStorage.removeItem("paypal_billing_cycle");
  localStorage.removeItem("paypal_credit_type");
  localStorage.removeItem("paypal_credit_amount");
  localStorage.removeItem("paypal_pack_id");
}

export default function CheckoutPayPalReturn() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("paypal_cancelled")) {
      clearPayPalLocalStorage();
      setStatus("failed");
      setErrorMessage("PayPal payment was cancelled.");
      return;
    }

    const orderId =
      params.get("token")
      ?? localStorage.getItem("paypal_order_id")
      ?? null;

    if (!orderId) {
      setStatus("failed");
      setErrorMessage("No PayPal order found. Please try checkout again or contact support.");
      return;
    }

    clearPayPalLocalStorage();

    async function capture() {
      try {
        const res = await fetch(`${basePath}/api/paypal/capture-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json() as { success?: boolean; error?: string; payer?: string };

        if (!res.ok || !data.success) {
          setStatus("failed");
          setErrorMessage(data.error ?? "PayPal payment could not be confirmed.");
          return;
        }

        queryClient.setQueryData(["user-profile-summary"], (prev: {
          onboardingCompleted?: boolean;
          subscription?: { status?: string; planName?: string } | null;
        } | undefined) => ({
          ...(prev ?? {}),
          onboardingCompleted: true,
          subscription: { ...(prev?.subscription ?? {}), status: "active" },
        }));
        await queryClient.invalidateQueries({ queryKey: ["user-profile-summary"] });
        await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        await queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
        await refetchCreditQueries(queryClient);

        setStatus("success");
        setTimeout(() => setLocation("/dashboard"), 1200);
      } catch {
        setStatus("failed");
        setErrorMessage("Could not confirm PayPal payment. Please contact support if you were charged.");
      }
    }

    capture();
  }, [queryClient, setLocation]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Confirming PayPal payment…</h1>
            <p className="text-slate-500 text-sm">Completing your purchase. This takes just a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-9 h-9 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment confirmed!</h1>
            <p className="text-slate-500 text-sm">Redirecting to your dashboard…</p>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-9 h-9 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment not completed</h1>
            <p className="text-sm text-red-600 mb-6">{errorMessage}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setLocation("/onboarding")}>Try again</Button>
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/billing")}>
                Billing
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
