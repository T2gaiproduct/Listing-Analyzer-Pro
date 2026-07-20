import { useQuery } from "@tanstack/react-query";
import { mergeHomepageCms, type HomepageCmsMap } from "@/lib/homepage-cms";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchHomepageCms(): Promise<HomepageCmsMap> {
  const res = await fetch(`${basePath}/api/cms/homepage`);
  if (!res.ok) return mergeHomepageCms({});
  const data = await res.json() as HomepageCmsMap;
  return mergeHomepageCms(data);
}

export function useHomepageCms() {
  const query = useQuery({
    queryKey: ["homepage-cms"],
    queryFn: fetchHomepageCms,
    staleTime: 60_000,
  });

  return {
    cms: query.data ?? mergeHomepageCms({}),
    isLoading: query.isLoading,
  };
}
