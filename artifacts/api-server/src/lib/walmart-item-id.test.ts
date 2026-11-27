import assert from "node:assert/strict";
import { parseWalmartItemIdFromListingUrl } from "./walmart-items-client.js";

assert.equal(
  parseWalmartItemIdFromListingUrl(
    "https://www.walmart.com/ip/Apple-AirPods-Pro-2nd-Generation/1752686519",
  ),
  "1752686519",
);
assert.equal(
  parseWalmartItemIdFromListingUrl("https://www.walmart.com/ip/1752686519"),
  "1752686519",
);
assert.equal(parseWalmartItemIdFromListingUrl("https://www.walmart.com/"), null);
assert.equal(parseWalmartItemIdFromListingUrl(""), null);

console.log("walmart-item-id tests passed");
