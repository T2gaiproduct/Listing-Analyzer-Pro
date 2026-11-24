import assert from "node:assert/strict";
import { parseImagePromptFieldsFromInstructions } from "./image-prompt-skill-utils.js";

function run() {
  const multiline = [
    "name: Social · Image prompt",
    "skill_kind: image_prompt",
    "---",
    "prompt_template: Line one of prompt",
    "Line two must be included.",
    "## Section",
    "Generate one premium image.",
  ].join("\n");
  const parsed = parseImagePromptFieldsFromInstructions(multiline);
  assert.ok(parsed.promptTemplate.includes("Line two must be included."));
  assert.ok(parsed.promptTemplate.includes("Generate one premium image."));

  const uploadOnly = [
    "name: Social",
    "---",
    "Do not generate fake reviews.",
    "Generate one premium Social Proof image.",
  ].join("\n");
  const fromUpload = parseImagePromptFieldsFromInstructions(uploadOnly);
  assert.ok(fromUpload.promptTemplate.includes("fake reviews"));
  assert.ok(fromUpload.promptTemplate.includes("Social Proof"));

  console.log("image-prompt-skill-utils.test.ts: ok");
}

run();