import assert from "node:assert/strict";
import {
  scratchWorkflowReadyForPreviewExport,
  workflowHasOptimizedScratchListing,
} from "./scratch-workflow-readiness.js";

function run() {
  const identity = { productName: "testing_product", brandName: "", category: "Home" };
  const uploadOnly = {
    title: "testing_product",
    bulletPoints: [],
    keywords: [],
    htmlDescription: "",
  };
  assert.equal(workflowHasOptimizedScratchListing(uploadOnly, [], identity), false);
  const aiListing = {
    title: "Premium Testing Product for Daily Use",
    bulletPoints: ["Real seller benefit one"],
    keywords: ["testing"],
    htmlDescription: "<p>Desc</p>",
  };
  assert.equal(workflowHasOptimizedScratchListing(aiListing, [], identity), true);
  assert.equal(
    scratchWorkflowReadyForPreviewExport(aiListing, [], identity, {
      imageRecords: [{ type: "main", currentUrl: "/api/images/graphics/abc/main_1.png" }],
    }),
    true,
  );
  assert.equal(
    scratchWorkflowReadyForPreviewExport(aiListing, [], identity, { imageRecords: [] }),
    false,
  );
  assert.equal(workflowHasOptimizedScratchListing(aiListing, [], identity), true);
  console.log("scratch-workflow-readiness.test.ts: ok");
}

run();