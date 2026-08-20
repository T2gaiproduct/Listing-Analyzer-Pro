import { AdsConsoleDataPage } from "./ads-console-data";
import {
  fetchAdsConsoleNegativeTargets,
  fetchAdsConsolePlacements,
} from "@/lib/ads-console-api";

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
