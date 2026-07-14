import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { refetchCreditQueries } from "@/lib/credit-queries";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CREDIT_RETURN_KEYS = ["credit_success", "custom_credit_success"] as const;

function stripCreditReturnParams(): void {
  const params = new URLSearchParams(window.location.search);
  let changed = false;
  for (const key of CREDIT_RETURN_KEYS) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (params.get("credit_cancel")) {
    params.delete("credit_cancel");
    changed = true;
  }
  if (!changed) return;

  const nextSearch = params.toString();
  const nextUrl = nextSearch
    ? `${window.location.pathname}?${nextSearch}`
    : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
}

/**
 * Confirms Stripe credit purchases on any dashboard page and refreshes the topbar balance.
 */
export function useCreditPurchaseReturn(): void {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const cancelled = params.get("credit_cancel");
    if (cancelled) {
      handledRef.current = true;
      toast({ title: "Credit purchase cancelled" });
      stripCreditReturnParams();
      return;
    }

    const sessionId = CREDIT_RETURN_KEYS.map((key) => params.get(key)).find(Boolean);
    if (!sessionId) return;

    handledRef.current = true;

    fetch(`${basePath}/api/buy-credits/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then(async (d: {
        success?: boolean;
        addedCredits?: number;
        creditType?: string;
        alreadyProcessed?: boolean;
        error?: string;
      }) => {
        stripCreditReturnParams();

        if (d.success) {
          await refetchCreditQueries(queryClient);
          if (!d.alreadyProcessed) {
            toast({
              title: "Credit purchase successful",
              description: `Added ${d.addedCredits} ${d.creditType} credits to your balance.`,
            });
          }
          return;
        }

        // Webhook may have fulfilled already — still refresh balance
        await refetchCreditQueries(queryClient);
        toast({
          title: "Credit confirmation issue",
          description: d.error ?? "If you were charged, credits may appear shortly. Refresh or contact support.",
          variant: "destructive",
        });
      })
      .catch(async () => {
        stripCreditReturnParams();
        await refetchCreditQueries(queryClient);
        toast({ title: "Confirmation error", variant: "destructive" });
      });
  }, [queryClient, toast]);
}
