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
    "Compliance Regulation Type",
    "Regulatory Identification",
  ]);
  assert.equal(values[values.length - 4], "CDPR Pest Identification");
  assert.equal(values[values.length - 1], "1AB1331-121A");
}

testOneColumnPerAttribute();
console.log("multi-marketplace-listing-export: one column per attribute");
