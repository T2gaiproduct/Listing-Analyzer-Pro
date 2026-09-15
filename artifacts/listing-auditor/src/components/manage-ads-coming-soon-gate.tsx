import { Redirect } from "wouter";
import { MANAGE_ADS_COMING_SOON } from "@/lib/ads-nav";

/** Blocks Manage Ads pages for customers while the feature is coming soon. */
export function ManageAdsComingSoonGate({ children }: { children: React.ReactNode }) {
  if (MANAGE_ADS_COMING_SOON) {
    return <Redirect to="/dashboard" />;
  }
  return <>{children}</>;
}
