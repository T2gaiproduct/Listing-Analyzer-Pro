export type CompanyContact = {
  supportEmail: string;
  supportPhone: string;
  companyAddress: string;
};

export const DEFAULT_COMPANY_CONTACT: CompanyContact = {
  supportEmail: "hello@listingauditor.com",
  supportPhone: "+1 (800) 555-0193",
  companyAddress: "San Francisco, CA 94105",
};

export const DEFAULT_SUPPORT_HOURS = "Mon–Fri, 9am–6pm PST";
