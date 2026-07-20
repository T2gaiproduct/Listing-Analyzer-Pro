import { useQuery } from "@tanstack/react-query";
import type { AnnouncementPromo } from "@/lib/announcement-promo";
import { ANNOUNCEMENT_PROMO_DEFAULTS } from "@/lib/announcement-promo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const FALLBACK: AnnouncementPromo = {
  enabled: true,
  text: ANNOUNCEMENT_PROMO_DEFAULTS.text,
  code: ANNOUNCEMENT_PROMO_DEFAULTS.code,
  linkText: ANNOUNCEMENT_PROMO_DEFAULTS.linkText,
  linkUrl: ANNOUNCEMENT_PROMO_DEFAULTS.linkUrl,
};

async function fetchPromoAnnouncement(): Promise<AnnouncementPromo> {
  const res = await fetch(`${basePath}/api/announcement/promo`);
  if (!res.ok) return FALLBACK;
  return res.json() as Promise<AnnouncementPromo>;
}

export function usePromoAnnouncement() {
  const query = useQuery({
    queryKey: ["announcement-promo"],
    queryFn: fetchPromoAnnouncement,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    promo: query.data ?? FALLBACK,
    isLoading: query.isLoading,
  };
}
