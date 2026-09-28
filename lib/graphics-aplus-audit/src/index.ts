/** Internal marker: audit exists only to host A+ generation from Create Graphics (not BYB / Product Explorer). */
export const GRAPHICS_APLUS_AUDIT_SHELL_DESCRIPTION = "__graphics_aplus_shell__";

export function isGraphicsAplusShellAudit(audit: {
  productDescription?: string | null;
}): boolean {
  return audit.productDescription === GRAPHICS_APLUS_AUDIT_SHELL_DESCRIPTION;
}

/** Hide Create Graphics A+ backing audits from Product Explorer (not BYB listings). */
export function shouldExcludeAuditFromProductExplorer(
  audit: {
    productDescription?: string | null;
    asin?: string | null;
    overallScore?: number | null;
    generatedContent?: unknown | null;
    currentStep?: number | null;
  },
  linkedToGraphicsProject: boolean,
): boolean {
  if (isGraphicsAplusShellAudit(audit)) return true;
  if (!linkedToGraphicsProject) return false;
  const hasListingProgress =
    audit.generatedContent != null
    || (audit.overallScore ?? 0) > 0
    || Boolean(audit.asin?.trim())
    || (audit.currentStep ?? 1) > 1;
  return !hasListingProgress;
}
