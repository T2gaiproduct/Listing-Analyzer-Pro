import type { QueryClient } from "@tanstack/react-query";
import { USER_SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-user-subscription";

/** Invalidate subscription + profile caches so topbar plan label updates immediately. */
export async function invalidateSubscriptionQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [...USER_SUBSCRIPTION_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: ["user-profile"] }),
    queryClient.invalidateQueries({ queryKey: ["user-profile-summary"] }),
  ]);
}

/** Refetch all client caches that display credit balances after spend or purchase. */
export async function refetchCreditQueries(queryClient: QueryClient): Promise<void> {
  await invalidateSubscriptionQueries(queryClient);
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ["user-credits"] }),
    queryClient.refetchQueries({ queryKey: ["team-membership-credits"] }),
    queryClient.refetchQueries({ queryKey: ["credit-usage"] }),
    queryClient.refetchQueries({ queryKey: ["team-overview"] }),
    queryClient.refetchQueries({ queryKey: [...USER_SUBSCRIPTION_QUERY_KEY] }),
    queryClient.refetchQueries({ queryKey: ["user-profile"] }),
    queryClient.refetchQueries({ queryKey: ["user-profile-summary"] }),
  ]);
}

export function refreshCreditBalances(queryClient: QueryClient): void {
  void refetchCreditQueries(queryClient);
}
