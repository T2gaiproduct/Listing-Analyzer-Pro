import { useQuery } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type PublicFaq = {
  id: number;
  question: string;
  answer: string;
};

export type PublicFaqItem = {
  id: number;
  q: string;
  a: string;
};

async function fetchPublicFaqs(): Promise<PublicFaq[]> {
  const res = await fetch(`${basePath}/api/faqs`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function mapPublicFaqs(items: PublicFaq[]): PublicFaqItem[] {
  return items.map((f) => ({
    id: f.id,
    q: f.question,
    a: f.answer,
  }));
}

export function usePublicFaqs(staleTime?: number) {
  return useQuery<PublicFaq[]>({
    queryKey: ["public-faqs"],
    queryFn: fetchPublicFaqs,
    staleTime,
  });
}
