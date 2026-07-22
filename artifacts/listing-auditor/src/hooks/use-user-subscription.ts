import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const USER_SUBSCRIPTION_QUERY_KEY = ["user-subscription"] as const;

export interface UserSubscription {
  planName: string | null;
  planId: number | null;
  status: string;
  billingCycle?: string;
  planAiCredits?: number;
  planImageCredits?: number;
  planAuditCredits?: number;
  priceMonthly?: number;
  priceYearly?: number;
  currentPeriodEnd?: string | null;
  stripeSubscriptionId?: string | null;
}

async function fetchUserSubscription(): Promise<UserSubscription | null> {
  const res = await fetch(`${basePath}/api/subscription`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json() as Promise<UserSubscription | null>;
}

/** Shared subscription query for topbar, billing, and dashboard (single cache key). */
export function useUserSubscription() {
  const { user, isLoaded } = useUser();

  return useQuery<UserSubscription | null>({
    queryKey: [...USER_SUBSCRIPTION_QUERY_KEY],
    queryFn: fetchUserSubscription,
    enabled: isLoaded && !!user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function planLabelFromSubscription(subscription: UserSubscription | null | undefined): string {
  const planName = subscription?.planName?.trim();
  if (planName) return `${planName} Plan`;
  if (subscription?.status) return "Active Plan";
  return "No plan";
}
