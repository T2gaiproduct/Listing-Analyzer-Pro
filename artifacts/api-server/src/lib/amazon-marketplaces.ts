/** Amazon Seller Central marketplaces supported for flat-file export. */
export const AMAZON_MARKETPLACES = [
  { id: "US", label: "United States (amazon.com)", domain: "amazon.com", siteCode: "US" },
  { id: "CA", label: "Canada (amazon.ca)", domain: "amazon.ca", siteCode: "CA" },
  { id: "MX", label: "Mexico (amazon.com.mx)", domain: "amazon.com.mx", siteCode: "MX" },
  { id: "UK", label: "United Kingdom (amazon.co.uk)", domain: "amazon.co.uk", siteCode: "UK" },
  { id: "DE", label: "Germany (amazon.de)", domain: "amazon.de", siteCode: "DE" },
  { id: "FR", label: "France (amazon.fr)", domain: "amazon.fr", siteCode: "FR" },
  { id: "IT", label: "Italy (amazon.it)", domain: "amazon.it", siteCode: "IT" },
  { id: "ES", label: "Spain (amazon.es)", domain: "amazon.es", siteCode: "ES" },
  { id: "NL", label: "Netherlands (amazon.nl)", domain: "amazon.nl", siteCode: "NL" },
  { id: "SE", label: "Sweden (amazon.se)", domain: "amazon.se", siteCode: "SE" },
  { id: "PL", label: "Poland (amazon.pl)", domain: "amazon.pl", siteCode: "PL" },
  { id: "BE", label: "Belgium (amazon.com.be)", domain: "amazon.com.be", siteCode: "BE" },
  { id: "IN", label: "India (amazon.in)", domain: "amazon.in", siteCode: "IN" },
  { id: "JP", label: "Japan (amazon.co.jp)", domain: "amazon.co.jp", siteCode: "JP" },
  { id: "AU", label: "Australia (amazon.com.au)", domain: "amazon.com.au", siteCode: "AU" },
  { id: "SG", label: "Singapore (amazon.sg)", domain: "amazon.sg", siteCode: "SG" },
  { id: "AE", label: "UAE (amazon.ae)", domain: "amazon.ae", siteCode: "AE" },
  { id: "SA", label: "Saudi Arabia (amazon.sa)", domain: "amazon.sa", siteCode: "SA" },
  { id: "TR", label: "Turkey (amazon.com.tr)", domain: "amazon.com.tr", siteCode: "TR" },
  { id: "BR", label: "Brazil (amazon.com.br)", domain: "amazon.com.br", siteCode: "BR" },
] as const;

export type AmazonMarketplaceId = (typeof AMAZON_MARKETPLACES)[number]["id"];

export function resolveAmazonMarketplace(input: string | undefined | null): (typeof AMAZON_MARKETPLACES)[number] {
  const normalized = (input ?? "US").trim().toUpperCase();
  const found = AMAZON_MARKETPLACES.find(
    (m) => m.id === normalized || m.siteCode === normalized || m.domain === input?.trim().toLowerCase(),
  );
  return found ?? AMAZON_MARKETPLACES[0];
}
