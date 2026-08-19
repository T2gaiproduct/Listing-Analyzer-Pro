import { Redirect } from "wouter";

/** Legacy landing — SellerMate console lives at /ads/campaigns */
export default function AdsPage() {
  return <Redirect to="/ads/campaigns" replace />;
}
