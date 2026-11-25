export type MemberCreditUpdateMode = "set" | "add";

export type CreditBuckets = {
  auditCredits: number;
  imageCredits: number;
  aiCredits: number;
};

export type MemberCreditEditFields = {
  auditCredits: string;
  aiCredits: string;
  imageCredits: string;
  /** Fields the user changed this session (add mode only sends these). */
  touched: { audit: boolean; ai: boolean; image: boolean };
  mode: MemberCreditUpdateMode;
  baseline: CreditBuckets;
};

export function emptyMemberCreditEdit(baseline: CreditBuckets): MemberCreditEditFields {
  return {
    auditCredits: String(baseline.auditCredits),
    aiCredits: String(baseline.aiCredits),
    imageCredits: String(baseline.imageCredits),
    touched: { audit: false, ai: false, image: false },
    mode: "add",
    baseline,
  };
}

export function parseCreditField(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export type MemberCreditPatchBody = {
  creditUpdateMode: MemberCreditUpdateMode;
  auditCredits?: number;
  aiCredits?: number;
  imageCredits?: number;
};

/** Build PATCH body for workspace member credits (partial / add-safe). */
export function buildMemberCreditPatchBody(edit: MemberCreditEditFields): MemberCreditPatchBody | null {
  const mode = edit.mode;
  const body: MemberCreditPatchBody = { creditUpdateMode: mode };

  if (mode === "add") {
    let any = false;
    if (edit.touched.audit) {
      body.auditCredits = parseCreditField(edit.auditCredits);
      any = true;
    }
    if (edit.touched.ai) {
      body.aiCredits = parseCreditField(edit.aiCredits);
      any = true;
    }
    if (edit.touched.image) {
      body.imageCredits = parseCreditField(edit.imageCredits);
      any = true;
    }
    return any ? body : null;
  }

  body.auditCredits = parseCreditField(edit.auditCredits);
  body.aiCredits = parseCreditField(edit.aiCredits);
  body.imageCredits = parseCreditField(edit.imageCredits);
  return body;
}

export function formatCreditBuckets(c: CreditBuckets): string {
  return `${c.auditCredits} audit · ${c.aiCredits} text · ${c.imageCredits} image`;
}

export function memberCreditsUpdatedToastDescription(
  previous: CreditBuckets,
  next: CreditBuckets,
  mode: MemberCreditUpdateMode,
): string {
  if (mode === "add") {
    const dAudit = next.auditCredits - previous.auditCredits;
    const dAi = next.aiCredits - previous.aiCredits;
    const dImg = next.imageCredits - previous.imageCredits;
    const parts: string[] = [];
    if (dAudit !== 0) parts.push(`${dAudit >= 0 ? "+" : ""}${dAudit} audit`);
    if (dAi !== 0) parts.push(`${dAi >= 0 ? "+" : ""}${dAi} text`);
    if (dImg !== 0) parts.push(`${dImg >= 0 ? "+" : ""}${dImg} image`);
    const delta = parts.length > 0 ? parts.join(", ") : "no change";
    return `Now ${formatCreditBuckets(next)} (${delta}).`;
  }
  return `Balances set to ${formatCreditBuckets(next)}.`;
}