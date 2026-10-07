import assert from "node:assert/strict";
import { workspaceFundedPoolTotal, workspaceMembersAllocationTotal } from "./workspace-credits.js";

function testFundedStaysAtAssignedWhenUsedIsCounted(): void {
  const unassigned = { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const remaining = { aiCredits: 49, imageCredits: 50, auditCredits: 50 };
  assert.equal(workspaceFundedPoolTotal(unassigned, remaining, 0), 149);
  assert.equal(workspaceFundedPoolTotal(unassigned, remaining, 1), 150);
  assert.equal(workspaceMembersAllocationTotal(remaining, 1), 150);
}

function testFundedIncludesUnassignedAndRemaining(): void {
  const unassigned = { aiCredits: 10, imageCredits: 0, auditCredits: 0 };
  const remaining = { aiCredits: 5, imageCredits: 0, auditCredits: 0 };
  assert.equal(workspaceFundedPoolTotal(unassigned, remaining, 2), 17);
}

testFundedStaysAtAssignedWhenUsedIsCounted();
testFundedIncludesUnassignedAndRemaining();
console.log("workspace-credit-usage: funded totals ok");
