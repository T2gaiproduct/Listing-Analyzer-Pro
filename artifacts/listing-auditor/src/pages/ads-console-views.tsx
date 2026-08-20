import { AdsConsoleDataPage } from "./ads-console-data";
import {
  fetchAdsConsolePlacements,
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

export function AdsPlacementsConsolePage() {
  return (
    <AdsConsoleDataPage
      config={{
        title: "Placements",
        queryKey: "ads-console-placements",
        fetcher: fetchAdsConsolePlacements,
        dataKey: "placements",
        columns: [
          { key: "campaignName", label: "Campaign" },
          { key: "placement", label: "Placement" },
          {
            key: "percentage",
            label: "Bid adjustment %",
            format: (v) => v == null ? "—" : `${v}%`,
          },
          { key: "state", label: "State" },
        ],
      }}
    />
  );
}
