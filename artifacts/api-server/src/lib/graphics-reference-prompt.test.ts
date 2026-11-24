import assert from "node:assert/strict";
import {
  shouldCompositeUploadOnlyForGraphicsType,
  buildGraphicsReferenceGenerationPrompt,
  buildGraphicsReferenceRetryPrompt,
} from "./graphics-reference-prompt.js";

function run() {
  assert.equal(shouldCompositeUploadOnlyForGraphicsType("hero"), true);
  assert.equal(shouldCompositeUploadOnlyForGraphicsType("social"), false);
  const wrappers = {
    referenceInstruction: "REF",
    referenceRules: "RULES",
    referenceRetry: "RETRY",
    compositeSceneSuffix: "",
    compositeFallbackScene: "",
  };
  const p = buildGraphicsReferenceGenerationPrompt("Skill body for {{productDesc}}.", wrappers);
  assert.match(p, /REF/);
  assert.match(p, /RULES/);
  assert.match(p, /Skill body/);
  assert.doesNotMatch(p, /lifestyle in-use image/i);
  const retry = buildGraphicsReferenceRetryPrompt(wrappers);
  assert.match(retry, /RETRY/);
  console.log("graphics-reference-prompt.test.ts: ok");
}

run();