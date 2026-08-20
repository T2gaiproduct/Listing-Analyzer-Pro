/** Demo mode serves SellerMate-style sample rows without Amazon Ads connected. */
export function isAdsConsoleDemoMode(): boolean {
  if (import.meta.env.VITE_ADS_CONSOLE_DEMO === "true" || import.meta.env.VITE_ADS_CONSOLE_DEMO === "1") {
    return true;
  }
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1" || params.get("demo") === "true";
}

export function withDemoQuery(params: URLSearchParams): URLSearchParams {
  if (isAdsConsoleDemoMode()) params.set("demo", "1");
  return params;
}

export function enableAdsConsoleDemoInUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("demo", "1");
  window.history.replaceState({}, "", url.toString());
}
