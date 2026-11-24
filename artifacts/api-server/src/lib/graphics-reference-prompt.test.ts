import assert from "node:assert/strict";
import {
  shouldCompositeUploadOnlyForGraphicsType,
  buildGraphicsReferenceGenerationPrompt,
} from "./graphics-reference-prompt.js";

function run() {
  assert.equal(shouldCompositeUploadOnlyForGraphicsType("hero"), true);
  assert.equal(shouldCompositeUploadOnlyForGraphicsType("social"), false);
  const p = buildGraphicsReferenceGenerationPrompt("Skill body for {{productDesc}}.", "lifestyle", "REF:");
  assert.match(p, /REF:/);
  assert.match(p, /Skill body/);
  assert.match(p, /lifestyle|reference product/i);
  console.log("graphics-reference-prompt.test.ts: ok");
}

run();