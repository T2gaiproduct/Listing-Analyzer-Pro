/** Image credit balance for owners (account) vs workspace members (assigned allowance). */
export function teamAwareImageCreditBalance(
  isTeamMember: boolean,
  memberImageCredits: number | undefined,
  accountImageCredits: number,
): number {
  return isTeamMember ? (memberImageCredits ?? 0) : accountImageCredits;
}

export function hasTeamAwareImageCredits(
  isTeamMember: boolean,
  memberImageCredits: number | undefined,
  accountImageCredits: number,
  needed: number,
): boolean {
  if (needed <= 0) return true;
  return teamAwareImageCreditBalance(isTeamMember, memberImageCredits, accountImageCredits) >= needed;
}
