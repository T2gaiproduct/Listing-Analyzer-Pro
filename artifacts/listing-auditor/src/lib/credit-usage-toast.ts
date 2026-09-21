import { toast } from "@/hooks/use-toast";

/** Must match @workspace/api-client-react custom-fetch CREDIT_USAGE_EVENT. */
export const CREDIT_USAGE_EVENT = "la:credit-usage";

export type CreditUsagePayload = {
  title: string;
  message: string;
};

let lastKey = "";
let lastAt = 0;

/** Show a deduped toast when credits are spent (API body or WebSocket notification). */
export function showCreditUsageToast(usage: CreditUsagePayload): void {
  const key = `${usage.title}\0${usage.message}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 2500) return;
  lastKey = key;
  lastAt = now;
  toast({
    title: usage.title,
    description: usage.message,
  });
}
