import assert from "node:assert/strict";
import type { CreditTotals } from "./workspace-credits.js";

type Mode = "set" | "add";

function resolveTargets(
  current: CreditTotals,
  mode: Mode,
  patch: { aiCredits?: number; imageCredits?: number; auditCredits?: number },
): CreditTotals {
  const next = { ...current };
  const apply = (key: keyof CreditTotals, raw: number | undefined, provided: boolean) => {
    if (!provided) return;
    const n = Math.max(0, Math.floor(raw ?? 0));
    next[key] = mode === "add" ? Math.max(0, current[key] + n) : n;
  };
  apply("aiCredits", patch.aiCredits, patch.aiCredits !== undefined);
  apply("imageCredits", patch.imageCredits, patch.imageCredits !== undefined);
  apply("auditCredits", patch.auditCredits, patch.auditCredits !== undefined);
  return next;
}

const current = { auditCredits: 10, aiCredits: 10, imageCredits: 3 };
const added = resolveTargets(current, "add", { imageCredits: 10 });
assert.deepEqual(added, { auditCredits: 10, aiCredits: 10, imageCredits: 13 });

const partial = resolveTargets(current, "set", { imageCredits: 10 });
assert.deepEqual(partial, { auditCredits: 10, aiCredits: 10, imageCredits: 10 });

console.log("workspace-member-credits-patch.test.ts: ok");