import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ebayEnvironmentFromListingUrl,
  mapEbayBrowseItemToFetchedListing,
  marketplaceIdFromEbayUrl,
} from "./ebay-browse-client.js";

describe("ebay-browse-client", () => {
  it("maps marketplace id from host", () => {
    assert.equal(marketplaceIdFromEbayUrl("https://www.ebay.com/itm/123"), "EBAY_US");
    assert.equal(marketplaceIdFromEbayUrl("https://www.ebay.co.uk/itm/123"), "EBAY_GB");
    assert.equal(marketplaceIdFromEbayUrl("https://www.ebay.de/itm/123"), "EBAY_DE");
    assert.equal(marketplaceIdFromEbayUrl("https://www.ebay.com.au/itm/123"), "EBAY_AU");
  });

  it("detects sandbox vs production environment from URL", () => {
    assert.equal(
      ebayEnvironmentFromListingUrl("https://www.ebay.com/itm/123"),
      "production",
    );
    assert.equal(
      ebayEnvironmentFromListingUrl("https://www.sandbox.ebay.com/itm/123"),
      "sandbox",
    );
  });

  it("maps Browse item payload into FetchedListing", () => {
    const listing = mapEbayBrowseItemToFetchedListing(
      {
        title: "Wireless Bluetooth Earbuds | Noise Cancelling",
        shortDescription: "Compact earbuds with long battery life.",
        brand: "Acme",
        categoryPath: "Electronics|Headphones",
        price: { value: "29.99", currency: "USD" },
        image: { imageUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg" },
        additionalImages: [{ imageUrl: "https://i.ebayimg.com/images/g/def/s-l1600.jpg" }],
        localizedAspects: [
          { name: "Color", value: "Black" },
          { name: "Connectivity", value: "Bluetooth" },
        ],
      },
      "https://www.ebay.com/itm/377681542438",
      "377681542438",
    );

    assert.equal(listing.asin, "ebay:377681542438");
    assert.equal(listing.title, "Wireless Bluetooth Earbuds | Noise Cancelling");
    assert.equal(listing.productName, "Wireless Bluetooth Earbuds");
    assert.equal(listing.price, "$29.99");
    assert.equal(listing.category, "Electronics|Headphones");
    assert.deepEqual(listing.imageUrls, [
      "https://i.ebayimg.com/images/g/abc/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/def/s-l1600.jpg",
    ]);
    assert.ok(listing.attributes.some((row) => row.attribute === "Color" && row.value === "Black"));
    assert.ok(listing.bulletPoints.some((line) => line.includes("Connectivity")));
  });
});
