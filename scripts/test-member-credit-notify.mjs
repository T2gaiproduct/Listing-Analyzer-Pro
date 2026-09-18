import assert from "node:assert/strict";
import {
  creditAssignmentIncreaseDelta,
  formatCreditAssignmentMessage,
} from "../artifacts/api-server/src/lib/workspace-member-credit-notify.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log("member-credit-notify tests");

test("delta: images-only assignment", () => {
  const delta = creditAssignmentIncreaseDelta(
    { auditCredits: 10, aiCredits: 0, imageCredits: 0 },
    { auditCredits: 10, aiCredits: 0, imageCredits: 50 },
  );
  assert.deepEqual(delta, { auditCredits: 0, aiCredits: 0, imageCredits: 50 });
});

test("message: images-only mentions images not existing audit balance", () => {
  const { message } = formatCreditAssignmentMessage(
    "Client A",
    { auditCredits: 0, aiCredits: 0, imageCredits: 50 },
  );
  assert.match(message, /50 credits for images/);
  assert.match(message, /Client A/);
  assert.doesNotMatch(message, /audit/i);
});

test("message: multiple types joined with and", () => {
  const { message } = formatCreditAssignmentMessage(
    "Agency WS",
    { auditCredits: 5, aiCredits: 0, imageCredits: 50 },
  );
  assert.match(message, /5 credits for audits/);
  assert.match(message, /50 credits for images/);
  assert.match(message, / and /);
});

test("delta ignores decreases", () => {
  const delta = creditAssignmentIncreaseDelta(
    { auditCredits: 20, aiCredits: 10, imageCredits: 5 },
    { auditCredits: 5, aiCredits: 10, imageCredits: 55 },
  );
  assert.deepEqual(delta, { auditCredits: 0, aiCredits: 0, imageCredits: 50 });
});

console.log("\nAll member-credit-notify tests passed.");
