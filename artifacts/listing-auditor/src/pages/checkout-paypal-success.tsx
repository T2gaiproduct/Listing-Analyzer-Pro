import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refetchCreditQueries } from "@/lib/credit-queries";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type PayPalReturnContext = {
  orderId: string | null;
  isPlanPurchase: boolean;
  isCreditPurchase: boolean;
};

function readPayPalReturnContext(): PayPalReturnContext {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token")?.trim();
  const storedOrderId =
    localStorage.getItem("paypal_order_id") ?? sessionStorage.getItem("paypal_order_id");
  const orderId = storedOrderId || urlToken || null;
  const planId = localStorage.getItem("paypal_plan_id");
  const packId = localStorage.getItem("paypal_pack_id");
  const creditType = localStorage.getItem("paypal_credit_type");
  const creditAmount = localStorage.getItem("paypal_credit_amount");
  return {
    orderId,
    isPlanPurchase: Boolean(planId),
    isCreditPurchase: Boolean(packId || creditType || creditAmount),
  };
}

function clearPayPalReturnStorage() {
  const keys = [
    "paypal_order_id",
    "paypal_plan_id",
    "paypal_billing_cycle",
    "paypal_credit_type",
    "paypal_credit_amount",
    "paypal_pack_id",
  ];
  for (const key of keys) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

async function markCheckoutComplete(queryClient: QueryClient) {
  queryClient.setQueryData(["user-profile-summary"], (prev: {
    onboardingCompleted?: boolean;
    subscription?: { status?: string; planName?: string } | null;
  } | undefined) => ({
    ...prev,
    onboardingCompleted: true,
    subscription: { ...(prev?.subscription ?? {}), status: "active" },
  }));
  await queryClient.refetchQueries({ queryKey: ["user-profile-summary"] });
  await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
  await queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
  await refetchCreditQueries(queryClient);
}

export default function CheckoutPayPalSuccess() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const capturedRef = useRef(false);

  useEffect(() => {
    if (capturedRef.current) return;

    const context = readPayPalReturnContext();

    async function tryReconcileAndRedirect(): Promise<boolean> {
      const reconcileRes = await fetch(`${basePath}/api/paypal/reconcile-pending`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!reconcileRes.ok) return false;
      const summaryRes = await fetch(`${basePath}/api/profile/summary`, { credentials: "include" });
      if (!summaryRes.ok) return false;
      const summary = await summaryRes.json() as {
        subscription?: { status?: string } | null;
      };
      const active = summary.subscription?.status === "active" || summary.subscription?.status === "trial";
      if (!active) return false;
      clearPayPalReturnStorage();
      setStatus("success");
      await markCheckoutComplete(queryClient);
      setTimeout(() => setLocation("/dashboard"), 1200);
      return true;
    }

    if (!context.orderId) {
      capturedRef.current = true;
      void tryReconcileAndRedirect().then((ok) => {
        if (!ok) {
          setStatus("failed");
          setErrorMessage("PayPal order not found. If you were charged, sign out and sign in again to sync your subscription.");
        }
      });
      return;
    }

    capturedRef.current = true;

    async function capture() {
      try {
        const res = await fetch(`${basePath}/api/paypal/capture-order`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: context.orderId }),
        });
        const data = await res.json() as {
          success?: boolean;
          error?: string;
          addedCredits?: number;
          creditType?: string;
        };

        if (!res.ok || !data.success) {
          const reconciled = await tryReconcileAndRedirect();
          if (!reconciled) {
            setStatus("failed");
            setErrorMessage(data.error ?? "PayPal capture failed. Please contact support if you were charged.");
          }
          return;
        }

        clearPayPalReturnStorage();
        setStatus("success");
        await markCheckoutComplete(queryClient);

        setTimeout(() => setLocation("/dashboard"), 1200);
      } catch {
        const reconciled = await tryReconcileAndRedirect();
        if (!reconciled) {
          clearPayPalReturnStorage();
          setStatus("failed");
          setErrorMessage("Could not verify PayPal payment. Sign out and sign in again, or contact support.");
        }
      }
    }

    void capture();
  }, [queryClient, setLocation]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">

        {status === "loading" && (
          <>
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Confirming your PayPal payment…</h1>
            <p className="text-slate-500 text-sm">Capturing your payment. This takes just a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-9 h-9 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment confirmed!</h1>
            <p className="text-slate-500 text-sm mb-6">Your payment was successful. Redirecting…</p>
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
