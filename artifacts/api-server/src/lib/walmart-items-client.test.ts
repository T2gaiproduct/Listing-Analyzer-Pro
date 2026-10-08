import assert from "node:assert/strict";
import { parseWalmartCatalogItem, parseWalmartItemsPage } from "./walmart-items-client.js";
import { walmartAsin, walmartListingUrl, walmartSkuFromAsin } from "./walmart-import-utils.js";

function testAsinRoundTrip(): void {
  const asin = walmartAsin("SKU 1");
  assert.equal(asin, "walmart:SKU%201");
  assert.equal(walmartSkuFromAsin(asin), "SKU 1");
  assert.equal(walmartListingUrl("2JDabc"), "https://www.walmart.com/ip/2JDabc");
}

function testParsesItemList(): void {
  const page = parseWalmartItemsPage({
    ItemResponse: [
      {
        sku: "WM-1",
        wpid: "12345",
        productName: "Trail mix",
        publishedStatus: "PUBLISHED",
        price: { amount: "12.50", currency: "USD" },
        images: [{ url: "https://i5.walmartimages.com/a.jpg" }],
      },
    ],
    totalItems: 1,
    nextCursor: "cursor-2",
  });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]?.sku, "WM-1");
  assert.equal(page.items[0]?.productName, "Trail mix");
  assert.equal(page.items[0]?.priceAmount, 12.5);
  assert.equal(page.items[0]?.imageUrls[0], "https://i5.walmartimages.com/a.jpg");
  assert.equal(page.nextCursor, "cursor-2");
  assert.equal(page.hasMore, true);
}

function testParsesSingleItemObject(): void {
  const item = parseWalmartCatalogItem({
    sku: "WM-2",
    productName: "Soap",
    shortDescription: "<p>Clean</p>",
    primaryImageUrl: "https://i5.walmartimages.com/b.jpg",
  });
  assert.equal(item?.sku, "WM-2");
  assert.equal(item?.descriptionHtml, "<p>Clean</p>");
  assert.equal(item?.imageUrls[0], "https://i5.walmartimages.com/b.jpg");
}

function testParsesWrappedSingleItem(): void {
  const page = parseWalmartItemsPage({
    ItemResponse: { sku: "WM-3", productName: "Solo" },
  });
  assert.equal(page.items[0]?.sku, "WM-3");
}

testAsinRoundTrip();
testParsesItemList();
testParsesSingleItemObject();
testParsesWrappedSingleItem();
console.log("walmart-items-client: ok");
