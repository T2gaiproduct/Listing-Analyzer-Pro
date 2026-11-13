import assert from "node:assert/strict";
import type { GeneratedContent } from "@workspace/db";
import { buildMarketplaceSheetRow } from "./multi-marketplace-listing-export.js";

function testOneColumnPerAttribute(): void {
  const content: GeneratedContent = {
    title: "Test Bed",
    bulletPoints: ["B1"],
    keywords: ["bed"],
    htmlDescription: "<p>Desc</p>",
    attributes: [
      { attribute: "Brand", value: "Furryfits" },
      { attribute: "Product Type", value: "Dog Bed" },
      { attribute: "Compliance Regulation Type", value: "CDPR Pest Identification" },
      { attribute: "Regulatory Identification", value: "1AB1331-121A" },
      { attribute: "Compliance Regulation Type", value: "CDPR Pest Identification" },
      { attribute: "Regulatory Identification", value: "1AB1331-121A" },
    ],
  };

  const { headers, values } = buildMarketplaceSheetRow(content);

  assert.equal(headers.includes("Attributes"), false);
  assert.deepEqual(headers, [
    "Title",
    "Bullet 1",
    "Bullet 2",
    "Bullet 3",
    "Bullet 4",
    "Bullet 5",
    "Keywords",
    "Description",
    "Brand",
    "Product Type",
    "Compliance Regulation Type",
    "Regulatory Identification",
  ]);
  assert.equal(values[values.length - 2], "CDPR Pest Identification");
  assert.equal(values[values.length - 1], "1AB1331-121A");
}

function testDedupeCaseInsensitive(): void {
  const { headers } = buildMarketplaceSheetRow({
    title: "T",
    bulletPoints: [],
    keywords: [],
    htmlDescription: "",
    attributes: [
      { attribute: "Brand", value: "A" },
      { attribute: "brand", value: "B" },
    ],
  });
  assert.equal(headers.filter((h) => h.toLowerCase() === "brand").length, 1);
}

testOneColumnPerAttribute();
testDedupeCaseInsensitive();
console.log("multi-marketplace-listing-export: one column per unique attribute");
