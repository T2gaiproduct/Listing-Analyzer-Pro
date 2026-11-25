import assert from "node:assert/strict";

function addBillingCycle(date: Date, billingCycle: string, direction: 1 | -1 = 1): Date {
  const next = new Date(date.getTime());
  if (billingCycle === "yearly") next.setFullYear(next.getFullYear() + direction);
  else next.setMonth(next.getMonth() + direction);
  return next;
}

const start = new Date(2026, 8, 10, 19, 13, 0); // Sep 10, 2026 local
const nextMonth = addBillingCycle(start, "monthly", 1);
assert.equal(nextMonth.getMonth(), 9);
assert.equal(nextMonth.getDate(), 10);

const prev = addBillingCycle(start, "monthly", -1);
assert.equal(prev.getMonth(), 7);

const nextYear = addBillingCycle(start, "yearly", 1);
assert.equal(nextYear.getFullYear(), 2027);

// Catch-up: Sep 10 end → roll until after Nov 25
let end = new Date(2026, 8, 10, 19, 13, 0);
const now = new Date(2026, 10, 25, 12, 0, 0);
let rolls = 0;
while (now.getTime() > end.getTime() && rolls < 12) {
  end = addBillingCycle(end, "monthly", 1);
  rolls += 1;
}
assert.equal(rolls, 3); // Oct 10, Nov 10, Dec 10
assert.equal(end.getMonth(), 11); // December

console.log("subscription-period-roll.test.ts: ok");
