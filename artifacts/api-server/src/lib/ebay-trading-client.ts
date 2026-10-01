import type { EbayAppCredentials, EbayOAuthEnvironment } from "./ebay-oauth-config.js";
import {
  describeEbayTradingApiSetupIssue,
  ebayOAuthEndpoints,
  getEbayAppCredentials,
} from "./ebay-oauth-config.js";

import { decodeXmlEntities, sanitizeEbayItemSpecificValues } from "./ebay-item-specific-limits.js";

function parseTradingErrorMessage(xml: string, fallback: string): string {
  const parts: string[] = [];
  for (const match of xml.matchAll(/<Errors>[\s\S]*?<ErrorCode>(\d+)<\/ErrorCode>[\s\S]*?<LongMessage>([^<]*)<\/LongMessage>/gi)) {
    const code = match[1]?.trim();
    const message = decodeXmlEntities(match[2]?.trim() ?? "");
    if (message) parts.push(code ? `[${code}] ${message}` : message);
  }
  if (parts.length > 0) return parts.join(" ");

  const raw = xml.match(/<LongMessage>([^<]*)<\/LongMessage>/)?.[1]
    || xml.match(/<ShortMessage>([^<]*)<\/ShortMessage>/)?.[1]
    || fallback;
  return decodeXmlEntities(raw);
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

export type EbayTradingItemDetails = {
  itemId: string;
  sku: string;
  title: string;
  descriptionHtml: string | null;
  imageUrls: string[];
  primaryCategoryId: string | null;
  priceCents: number | null;
  currency: string;
};

export type EbayItemSpecific = {
  name: string;
  values: string[];
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

function wrapCdata(html: string): string {
  const safe = html.replace(/\]\]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${safe}]]>`;
}

function parsePriceCentsFromItemXml(xml: string): number | null {
  const priceMatch = xml.match(/<StartPrice[^>]*>([^<]+)<\/StartPrice>/)
    ?? xml.match(/<BuyItNowPrice[^>]*>([^<]+)<\/BuyItNowPrice>/);
  if (!priceMatch?.[1]) return null;
  const value = Number.parseFloat(priceMatch[1].trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function parseCurrencyFromItemXml(xml: string): string {
  const attr = xml.match(/<StartPrice currencyID="([^"]+)"/)?.[1]
    ?? xml.match(/<BuyItNowPrice currencyID="([^"]+)"/)?.[1];
  return attr?.trim() || "USD";
}

function buildItemSpecificsXml(specifics: EbayItemSpecific[]): string {
  const rows = specifics
    .map((row) => {
      const name = row.name.trim();
      const values = sanitizeEbayItemSpecificValues(row.values).slice(0, 5);
      if (!name || values.length === 0) return "";
      const valueXml = values.map((value) => `<Value>${escapeXml(value)}</Value>`).join("");
      return `<NameValueList><Name>${escapeXml(name)}</Name>${valueXml}</NameValueList>`;
    })
    .filter(Boolean);
  if (rows.length === 0) return "";
  return `<ItemSpecifics>${rows.join("")}</ItemSpecifics>`;
}

/**
 * Host gallery images on eBay (EPS) so listings do not depend on SellerLens fetch URLs.
 */
function parseHostedPictureUrlFromUploadResponse(xml: string): string | null {
  const raw = xml.match(/<FullURL>([^<]+)<\/FullURL>/)?.[1]?.trim()
    ?? xml.match(/<MemberURL>([^<]+)<\/MemberURL>/)?.[1]?.trim();
  if (!raw) return null;
  const decoded = decodeXmlEntities(raw).trim();
  if (!decoded) return null;
  try {
    const url = new URL(decoded.startsWith("http") ? decoded : `https:${decoded}`);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.toString();
  } catch {
    return decoded.replace(/^http:/i, "https:");
  }
}

export async function uploadEbaySiteHostedPicture(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  pictureName: string;
  pictureData?: Buffer;
  externalPictureUrl?: string;
  siteId?: number;
}): Promise<string> {
  const name = input.pictureName.trim() || "sellerlens.jpg";
  const external = input.externalPictureUrl?.trim();
  const data = input.pictureData;

  let body: string;
  if (data && data.length > 0) {
    const base64 = data.toString("base64");
    body = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <PictureName>${escapeXml(name)}</PictureName>
  <PictureData>${base64}</PictureData>
</UploadSiteHostedPicturesRequest>`;
  } else if (external && /^https:\/\//i.test(external)) {
    body = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <PictureName>${escapeXml(name)}</PictureName>
  <ExternalPictureURL>${escapeXml(external)}</ExternalPictureURL>
</UploadSiteHostedPicturesRequest>`;
  } else {
    throw new Error("Picture bytes or an HTTPS image URL is required for eBay picture upload.");
  }

  const text = await postTradingApiRequest({
    environment: input.environment,
    accessToken: input.accessToken,
    callName: "UploadSiteHostedPictures",
    body,
    siteId: input.siteId,
  });
  const fullUrl = parseHostedPictureUrlFromUploadResponse(text);
  if (!fullUrl) {
    throw new Error(parseTradingErrorMessage(text, "UploadSiteHostedPictures failed"));
  }
  return fullUrl;
}

/**
 * Update title, description, gallery, price, and item specifics on one existing listing (this Item ID only).
 */
export async function reviseEbayListingContent(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  itemId: string;
  title: string;
  descriptionHtml: string;
  pictureUrls: string[];
  priceCents?: number | null;
  currency?: string | null;
  primaryCategoryId?: string | null;
  itemSpecifics?: EbayItemSpecific[];
  siteId?: number;
}): Promise<void> {
  const itemId = input.itemId.trim();
  const title = input.title.trim();
  if (!itemId || !title) {
    throw new Error("Item ID and title are required to update an eBay listing.");
  }

  const pictures = input.pictureUrls
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 12);
  const pictureXml = pictures.length > 0
    ? `<PictureDetails>${pictures.map((url) => `<PictureURL>${escapeXml(url)}</PictureURL>`).join("")}</PictureDetails>`
    : "";
  const descriptionBlock = input.descriptionHtml.trim()
    ? `<Description>${wrapCdata(input.descriptionHtml.trim())}</Description>`
    : "";

  let priceXml = "";
  if (input.priceCents != null && input.priceCents > 0) {
    const currency = (input.currency?.trim() || "USD").toUpperCase();
    const amount = (input.priceCents / 100).toFixed(2);
    priceXml = `<StartPrice currencyID="${escapeXml(currency)}">${escapeXml(amount)}</StartPrice>`;
  }

  const categoryId = input.primaryCategoryId?.trim();
  const categoryXml = categoryId
    ? `<PrimaryCategory><CategoryID>${escapeXml(categoryId)}</CategoryID></PrimaryCategory>`
    : "";

  const specificsXml = buildItemSpecificsXml(input.itemSpecifics ?? []);

  const body = `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <Item>
    <ItemID>${escapeXml(itemId)}</ItemID>
    <Title>${escapeXml(title)}</Title>
    ${descriptionBlock}
    ${pictureXml}
    ${priceXml}
    ${categoryXml}
    ${specificsXml}
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

/** Price-only revise — separated from content/gallery to avoid sandbox ReviseItem failures. */
export async function reviseEbayListingPrice(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  itemId: string;
  priceCents: number;
  currency?: string | null;
  siteId?: number;
}): Promise<void> {
  const itemId = input.itemId.trim();
  if (!itemId || input.priceCents <= 0) {
    throw new Error("Item ID and price are required to update an eBay listing price.");
  }
  const currency = (input.currency?.trim() || "USD").toUpperCase();
  const amount = (input.priceCents / 100).toFixed(2);
  const body = `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <Item>
    <ItemID>${escapeXml(itemId)}</ItemID>
    <StartPrice currencyID="${escapeXml(currency)}">${escapeXml(amount)}</StartPrice>
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
    throw new Error(parseTradingErrorMessage(text, "ReviseItem price update failed"));
  }
}

function parseGetItemDetailsXml(xml: string, itemId: string): EbayTradingItemDetails {
  const title = xml.match(/<Title>([^<]*)<\/Title>/)?.[1]?.trim() || "";
  const sku = xml.match(/<SKU>([^<]*)<\/SKU>/)?.[1]?.trim() || "";
  const descriptionHtml = xml.match(/<Description>([\s\S]*?)<\/Description>/)?.[1]?.trim() || null;
  const primaryCategoryId = xml.match(/<PrimaryCategory>[\s\S]*?<CategoryID>(\d+)<\/CategoryID>/)?.[1]?.trim()
    ?? null;
  const imageUrls: string[] = [];
  for (const match of xml.matchAll(/<PictureURL>([^<]+)<\/PictureURL>/g)) {
    const url = match[1]?.trim();
    if (url) imageUrls.push(url);
  }
  return {
    itemId,
    sku,
    title,
    descriptionHtml,
    imageUrls,
    primaryCategoryId,
    priceCents: parsePriceCentsFromItemXml(xml),
    currency: parseCurrencyFromItemXml(xml),
  };
}

/** Full listing payload for sandbox import when inventory migrate is unavailable. */
export async function fetchEbayTradingItemDetails(input: {
  environment: EbayOAuthEnvironment;
  accessToken: string;
  itemId: string;
  siteId?: number;
}): Promise<EbayTradingItemDetails> {
  const itemId = input.itemId.trim();
  if (!itemId) {
    throw new Error("Item ID is required for GetItem.");
  }
  const body = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${escapeXml(itemId)}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  const text = await postTradingApiRequest({
    environment: input.environment,
    accessToken: input.accessToken,
    callName: "GetItem",
    body,
    siteId: input.siteId,
  });
  if (/<Ack>PartialFailure<\/Ack>/i.test(text)) {
    throw new Error(parseTradingErrorMessage(text, "GetItem failed"));
  }
  return parseGetItemDetailsXml(text, itemId);
}
