import assert from "node:assert/strict";
import type { Audit } from "@workspace/db";
import { resolveListingContentForExport } from "./resolve-listing-content.js";

function run() {
  const audit = {
    id: 1,
    projectOrigin: "build_brand_scratch",
    productName: "testing_product",
    brandName: "",
    category: "Home",
    title: "testing_product",
    bulletPoints: [],
    targetKeywords: [],
    generatedContent: {
      title: "testing_product",
      bulletPoints: [],
      keywords: [],
      htmlDescription: "",
    },
  } as Audit;

  const content = resolveListingContentForExport(audit);
  assert.equal(content.title, "");
  assert.deepEqual(content.bulletPoints, []);
  console.log("scratch-listing-export.test.ts: ok");
}

run();