import { AdsConsoleDataPage } from "./ads-console-data";
import {
  fetchAdsConsoleNegativeTargets,
  fetchAdsConsoleProductAds,
} from "@/lib/ads-console-api";

export function AdsProductsConsolePage() {
  return (
    <AdsConsoleDataPage
      config={{
        title: "Ads Products",
        queryKey: "ads-console-product-ads",
        fetcher: fetchAdsConsoleProductAds,
        dataKey: "productAds",
        columns: [
          { key: "asin", label: "ASIN" },
          { key: "sku", label: "SKU" },
          { key: "state", label: "State" },
          { key: "campaignId", label: "Campaign ID" },
          { key: "adGroupId", label: "Ad Group ID" },
        ],
      }}
    />
  );
}

export function AdsNegativeTargetsConsolePage() {
  return (
    <AdsConsoleDataPage
      config={{
        title: "Negative Targets",
        queryKey: "ads-console-negative-targets",
        fetcher: fetchAdsConsoleNegativeTargets,
        dataKey: "negativeTargets",
        columns: [
          { key: "keywordText", label: "Keyword" },
          { key: "matchType", label: "Match Type" },
          { key: "state", label: "State" },
          { key: "campaignId", label: "Campaign ID" },
          { key: "adGroupId", label: "Ad Group ID" },
        ],
      }}
    />
  );
}
