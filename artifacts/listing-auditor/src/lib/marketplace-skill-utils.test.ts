import assert from "node:assert/strict";
import { extractSkillInstructionBody } from "./marketplace-skill-utils.js";

function run() {
  const crlf = "name: Amazon\r\nskill_kind: marketplace_content\r\n---\r\nNew body rules";
  assert.equal(extractSkillInstructionBody(crlf), "New body rules");
  const leading = "---\nBody only";
  assert.equal(extractSkillInstructionBody(leading), "Body only");
  console.log("marketplace-skill-utils.test.ts: ok");
}

run();