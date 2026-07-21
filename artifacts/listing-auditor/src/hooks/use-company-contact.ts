import { useQuery } from "@tanstack/react-query";
import { DEFAULT_COMPANY_CONTACT, type CompanyContact } from "@/lib/company-contact";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchCompanyContact(): Promise<CompanyContact> {
  const res = await fetch(`${basePath}/api/company`);
  if (!res.ok) return DEFAULT_COMPANY_CONTACT;
  return res.json() as Promise<CompanyContact>;
}

export function useCompanyContact() {
  const query = useQuery({
    queryKey: ["company-contact"],
    queryFn: fetchCompanyContact,
    staleTime: 5 * 60 * 1000,
  });

  return {
    contact: query.data ?? DEFAULT_COMPANY_CONTACT,
    isLoading: query.isLoading,
  };
}
