import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, XCircle, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CheckoutCardSuccess() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [cardInfo, setCardInfo] = useState<{ last4: string | null; brand: string | null }>({ last4: null, brand: null });
  const [errorMessage, setErrorMessage] = useState("");
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (confirmedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("failed");
      setErrorMessage("No session ID found. Please try again.");
      return;
    }

    async function confirm() {
      try {
        confirmedRef.current = true;
        const res = await fetch(`${basePath}/api/stripe/setup-card-confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json() as { success?: boolean; cardLast4?: string | null; cardBrand?: string | null; error?: string };

        if (!res.ok || !data.success) {
          setStatus("failed");
          setErrorMessage(data.error ?? "Could not confirm card setup. Please try again.");
          return;
        }

        setCardInfo({ last4: data.cardLast4 ?? null, brand: data.cardBrand ?? null });
        setStatus("success");
        setTimeout(() => setLocation("/billing"), 2500);
      } catch {
        setStatus("failed");
        setErrorMessage("A network error occurred. Please try again.");
      }
    }

    confirm();
  }, [setLocation]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">

        {status === "loading" && (
          <>
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Verifying your card…</h1>
            <p className="text-slate-500 text-sm">Confirming and releasing the $1 authorization hold.</p>
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
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Card saved!</h1>
            {cardInfo.last4 ? (
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-9 h-6 bg-slate-900 rounded flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-slate-600 text-sm font-medium">
                  {cardInfo.brand ?? "Card"} ending in {cardInfo.last4}
                </p>
              </div>
            ) : null}
            <p className="text-slate-500 text-sm mb-6">
              The $1 authorization hold has been released. Your card is saved for future payments.
            </p>
            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full" style={{ width: "100%", transition: "width 2.5s linear" }} />
            </div>
            <p className="text-xs text-slate-400 mt-3">Redirecting to billing…</p>
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
              <Button variant="outline" onClick={() => setLocation("/billing")}>Back to Billing</Button>
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
