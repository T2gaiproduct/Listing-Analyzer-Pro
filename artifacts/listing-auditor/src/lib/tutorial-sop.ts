/** Parse admin/CMS SOP text — one step per line; optional leading numbers. */
export function parseTutorialSopLines(sop: string | undefined | null): string[] {
  if (!sop?.trim()) return [];
  return sop
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[\).\s]+/, "").trim())
    .filter(Boolean);
}

export function tutorialSopStepCount(sop: string | undefined, fallbackSteps?: string): string {
  const parsed = parseTutorialSopLines(sop);
  if (parsed.length > 0) return String(parsed.length);
  const n = fallbackSteps?.trim();
  return n || "";
}