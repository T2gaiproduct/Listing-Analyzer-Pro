import type { EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import { ebayOAuthEndpoints, getEbayAppCredentials } from "./ebay-oauth-config.js";

export type EbayActiveListing = {
  itemId: string;
  sku: string | null;
  title: string | null;
};

function tradingApiUrl(environment: EbayOAuthEnvironment): string {
  const { apiBaseUrl } = ebayOAuthEndpoints(environment);
  return `${apiBaseUrl}/ws/api.dll`;
}

function parseActiveListingsXml(xml: string): EbayActiveListing[] {
  const listings: EbayActiveListing[] = [];
  const seen = new Set<string>();
  const itemBlocks = xml.match(/<Item>[\s\S]*?<\/Item>/g) ?? [];
  for (const block of itemBlocks) {
    const itemId = block.match(/<ItemID>(\d+)<\/ItemID>/)?.[1];
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    const sku = block.match(/<SKU>([^<]*)<\/SKU>/)?.[1]?.trim() || null;
    const title = block.match(/<Title>([^<]*)<\/Title>/)?.[1]?.trim() || null;
    listings.push({ itemId, sku, title });
  }
  if (listings.length === 0) {
    for (const match of xml.matchAll(/<ItemID>(\d+)<\/ItemID>/g)) {
      const itemId = match[1];
      if (!itemId || seen.has(itemId)) continue;
      seen.add(itemId);
      listings.push({ itemId, sku: null, title: null });
    }
  }
  return listings;
}

function parseTotalPages(xml: string): number {
  const totalPages = xml.match(/<TotalNumberOfPages>(\d+)<\/TotalNumberOfPages>/)?.[1];
  return totalPages ? Number.parseInt(totalPages, 10) : 1;
}

/**
 * Active seller listings (UI / Trading / legacy), including ItemID values like sandbox /itm/110590823948.
 */
export async function fetchEbayActiveListingsPage(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  page: number;
  entriesPerPage: number;
  siteId?: number;
}): Promise<{ listings: EbayActiveListing[]; totalPages: number }> {
  const creds = getEbayAppCredentials(input.environment);
  if (!creds) {
    throw new Error(`eBay ${input.environment} app credentials are not configured.`);
  }

  const page = Math.max(1, input.page);
  const entriesPerPage = Math.min(Math.max(input.entriesPerPage, 1), 200);
  const body = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination>
      <EntriesPerPage>${entriesPerPage}</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>`;

  // Trading (SOAP) APIs use OAuth via X-EBAY-API-IAF-TOKEN — not Authorization: Bearer (REST only).
  const res = await fetch(tradingApiUrl(input.environment), {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-IAF-TOKEN": input.accessToken,
      "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
      "X-EBAY-API-SITEID": String(input.siteId ?? 0),
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1423",
      "X-EBAY-API-APP-ID": creds.clientId,
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `eBay GetMyeBaySelling failed (${res.status})`);
  }
  if (/<Ack>Failure<\/Ack>/i.test(text) || /<Ack>PartialFailure<\/Ack>/i.test(text)) {
    const message = text.match(/<LongMessage>([^<]*)<\/LongMessage>/)?.[1]
      || text.match(/<ShortMessage>([^<]*)<\/ShortMessage>/)?.[1]
      || "GetMyeBaySelling failed";
    throw new Error(message);
  }

  return {
    listings: parseActiveListingsXml(text),
    totalPages: parseTotalPages(text),
  };
}

export async function fetchAllEbayActiveListings(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  maxListings: number;
}): Promise<EbayActiveListing[]> {
  const max = Math.min(Math.max(input.maxListings, 1), 500);
  const collected: EbayActiveListing[] = [];
  let page = 1;
  let totalPages = 1;

  while (collected.length < max && page <= totalPages) {
    const batch = await fetchEbayActiveListingsPage({
      environment: input.environment,
      accessToken: input.accessToken,
      page,
      entriesPerPage: Math.min(200, max - collected.length),
    });
    totalPages = batch.totalPages;
    for (const listing of batch.listings) {
      collected.push(listing);
      if (collected.length >= max) break;
    }
    page += 1;
    if (batch.listings.length === 0) break;
  }

  return collected;
}
