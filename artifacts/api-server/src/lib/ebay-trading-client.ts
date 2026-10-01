import type { EbayAppCredentials, EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import {
  describeEbayTradingApiSetupIssue,
  ebayOAuthEndpoints,
  getEbayAppCredentials,
} from "./ebay-oauth-config.js";

function parseTradingErrorMessage(xml: string, fallback: string): string {
  return xml.match(/<LongMessage>([^<]*)<\/LongMessage>/)?.[1]
    || xml.match(/<ShortMessage>([^<]*)<\/ShortMessage>/)?.[1]
    || fallback;
}

async function postTradingApiRequest(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  callName: string;
  body: string;
  siteId?: number;
}): Promise<string> {
  const creds = getEbayAppCredentials(input.environment);
  if (!creds) {
    throw new Error(`eBay ${input.environment} app credentials are not configured.`);
  }
  const tradingSetupIssue = describeEbayTradingApiSetupIssue(input.environment);
  if (tradingSetupIssue) {
    throw new Error(tradingSetupIssue);
  }

  const res = await fetch(tradingApiUrl(input.environment), {
    method: "POST",
    headers: buildTradingApiHeaders({
      creds,
      accessToken: input.accessToken,
      callName: input.callName,
      siteId: input.siteId ?? 0,
    }),
    body: input.body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `eBay ${input.callName} failed (${res.status})`);
  }
  if (/<Ack>Failure<\/Ack>/i.test(text)) {
    throw new Error(parseTradingErrorMessage(text, `${input.callName} failed`));
  }
  return text;
}

function buildTradingApiHeaders(input: {
  creds: EbayAppCredentials;
  accessToken: string;
  callName: string;
  siteId: number;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "text/xml",
    "X-EBAY-API-IAF-TOKEN": input.accessToken,
    "X-EBAY-API-CALL-NAME": input.callName,
    "X-EBAY-API-SITEID": String(input.siteId),
    "X-EBAY-API-COMPATIBILITY-LEVEL": "1423",
  };
  if (input.creds.devId && input.creds.certId) {
    headers["X-EBAY-API-DEV-NAME"] = input.creds.devId;
    headers["X-EBAY-API-APP-NAME"] = input.creds.clientId;
    headers["X-EBAY-API-CERT-NAME"] = input.creds.certId;
  } else {
    headers["X-EBAY-API-APP-ID"] = input.creds.clientId;
  }
  return headers;
}

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
  const tradingSetupIssue = describeEbayTradingApiSetupIssue(input.environment);
  if (tradingSetupIssue) {
    throw new Error(tradingSetupIssue);
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

  const text = await postTradingApiRequest({
    environment: input.environment,
    accessToken: input.accessToken,
    callName: "GetMyeBaySelling",
    body,
    siteId: input.siteId,
  });
  if (/<Ack>PartialFailure<\/Ack>/i.test(text)) {
    throw new Error(parseTradingErrorMessage(text, "GetMyeBaySelling failed"));
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

/**
 * Set SKU on a live Trading listing (required before bulk_migrate_listing when SKU was never set in UI).
 */
export async function reviseEbayListingSku(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  itemId: string;
  sku: string;
  siteId?: number;
}): Promise<void> {
  const sku = input.sku.trim();
  const itemId = input.itemId.trim();
  if (!sku || !itemId) {
    throw new Error("Item ID and SKU are required to revise an eBay listing.");
  }
  const body = `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <Item>
    <ItemID>${escapeXml(itemId)}</ItemID>
    <SKU>${escapeXml(sku)}</SKU>
  </Item>
</ReviseItemRequest>`;

  const text = await postTradingApiRequest({
    environment: input.environment,
    accessToken: input.accessToken,
    callName: "ReviseItem",
    body,
    siteId: input.siteId,
  });
  if (/<Ack>PartialFailure<\/Ack>/i.test(text)) {
    throw new Error(parseTradingErrorMessage(text, "ReviseItem failed"));
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
