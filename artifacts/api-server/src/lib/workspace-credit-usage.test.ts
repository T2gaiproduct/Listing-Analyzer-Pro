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

/** Period-filtered Used=0 must not shrink Funded when all-time usage is counted. */
function testAllTimeUsedKeepsFundedStableAcrossPeriods(): void {
  const unassigned = { aiCredits: 100, imageCredits: 96, auditCredits: 2 };
  const memberRemaining = { aiCredits: 0, imageCredits: 0, auditCredits: 0 };
  const usedThisPeriod = 0;
  const usedAllTime = 161;
  assert.equal(workspaceFundedPoolTotal(unassigned, memberRemaining, usedThisPeriod), 198);
  assert.equal(workspaceFundedPoolTotal(unassigned, memberRemaining, usedAllTime), 359);
}

testFundedStaysAtAssignedWhenUsedIsCounted();
testFundedIncludesUnassignedAndRemaining();
testAllTimeUsedKeepsFundedStableAcrossPeriods();
console.log("workspace-credit-usage: funded totals ok");
