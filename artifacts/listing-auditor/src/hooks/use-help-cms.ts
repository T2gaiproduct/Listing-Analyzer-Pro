import { useQuery } from "@tanstack/react-query";
import { mergeHelpCms, type HelpCmsMap } from "@/lib/help-cms";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchHelpCms(): Promise<HelpCmsMap> {
  const res = await fetch(`${basePath}/api/cms/help`);
  if (!res.ok) {
    console.warn(`[help-cms] GET /api/cms/help failed (${res.status}); using defaults`);
    return mergeHelpCms(null);
  }
  const data = (await res.json()) as HelpCmsMap;
  return mergeHelpCms(data);
}

export function useHelpCms() {
  return useQuery({
    queryKey: ["help-cms"],
    queryFn: fetchHelpCms,
    staleTime: 60_000,
  });
}
