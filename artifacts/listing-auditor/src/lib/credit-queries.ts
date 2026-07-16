import type { QueryClient } from "@tanstack/react-query";

/** Refetch all client caches that display credit balances after spend or purchase. */
export async function refetchCreditQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ["user-profile"] }),
    queryClient.refetchQueries({ queryKey: ["user-profile-summary"] }),
    queryClient.refetchQueries({ queryKey: ["user-credits"] }),
    queryClient.refetchQueries({ queryKey: ["team-membership-credits"] }),
    queryClient.refetchQueries({ queryKey: ["credit-usage"] }),
    queryClient.refetchQueries({ queryKey: ["team-overview"] }),
    queryClient.refetchQueries({ queryKey: ["user-subscription"] }),
  ]);
}

export function refreshCreditBalances(queryClient: QueryClient): void {
  void refetchCreditQueries(queryClient);
}
