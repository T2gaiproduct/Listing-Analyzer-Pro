/**
 * Production UI placeholders for Ecommerce Guru (fictional examples — not real customers or staff).
 */
export const ECOMMERCE_GURU_PLACEHOLDERS = {
  fullName: "Alex Morgan",
  email: "you@yourbrand.com",
  company: "Summit Commerce Co.",
  companyShort: "Summit Commerce",
  agency: "Your agency name",
  workspaceClient: "Summit Commerce",
  teamEmail: "team@yourbrand.com",
} as const;

export function egPlaceholderCompanyWithPrefix(prefix = "e.g."): string {
  return `${prefix} ${ECOMMERCE_GURU_PLACEHOLDERS.companyShort}`;
}
