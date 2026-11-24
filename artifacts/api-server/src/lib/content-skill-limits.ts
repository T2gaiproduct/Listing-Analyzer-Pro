import type { ContentMarketplaceRules } from "@workspace/db";
import { extractGenerationInstructionsFromSkillText } from "./content-marketplace-skill-sync.js";

/** YAML header lines (before `---`) from a marketplace skill file. */
export function extractSkillYamlHeader(instructionsText: string): string {
  const normalized = instructionsText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const marker = "\n---\n";
  const idx = normalized.indexOf(marker);
  if (idx >= 0) return normalized.slice(0, idx).trim();
  if (normalized.startsWith("---\n")) return "";
  const firstHr = normalized.match(/^\s*---\s*$/m);
  if (firstHr && firstHr.index != null) return normalized.slice(0, firstHr.index).trim();
  return "";
}

/** Parse `title_max: 75` style limits from the skill YAML header. */
export function parseSkillHeaderContentLimits(header: string): Partial<ContentMarketplaceRules> {
  const out: Partial<ContentMarketplaceRules> = {};
  for (const rawLine of header.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) continue;
    switch (key) {
      case "title_max":
        out.titleMaxChars = Math.round(num);
        break;
      case "title_min":
        out.titleMinChars = Math.round(num);
        break;
      case "bullets":
        out.bulletCount = Math.round(num);
        break;
      case "bullet_max":
        out.bulletMaxChars = Math.round(num);
        break;
      case "bullet_min":
        out.bulletMinChars = Math.round(num);
        break;
      case "desc_max_words":
        out.descriptionMaxWords = Math.round(num);
        break;
      case "desc_min_words":
        out.descriptionMinWords = Math.round(num);
        break;
      case "keywords":
      case "keyword_count":
        out.keywordCount = Math.round(num);
        break;
      default:
        break;
    }
  }
  return out;
}

/** e.g. "75 characters including spaces" in admin skill markdown tables. */
export function inferTitleMaxCharsFromProse(instructionsBody: string): number | undefined {
  const text = instructionsBody.trim();
  if (!text) return undefined;

  const patterns = [
    /(\d{2,3})\s*characters?\s+including\s+spaces/gi,
    /maximum\s+length[\s\S]{0,80}?(\d{2,3})\s*characters?/gi,
    /title[\s\S]{0,120}?maximum[\s\S]{0,40}?(\d{2,3})\s*characters?/gi,
    /max(?:imum)?\.?\s+length[\s\S]{0,60}?(\d{2,3})\s*char/gi,
  ];

  const found: number[] = [];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1]!, 10);
      if (n >= 20 && n <= 300) found.push(n);
    }
  }
  if (found.length === 0) return undefined;
  return Math.min(...found);
}

export function mergeListingContentRules(
  base: ContentMarketplaceRules | null | undefined,
  ...overrides: Array<Partial<ContentMarketplaceRules> | null | undefined>
): ContentMarketplaceRules | null | undefined {
  let merged: ContentMarketplaceRules = { ...(base ?? {}) };
  for (const patch of overrides) {
    if (!patch) continue;
    merged = { ...merged, ...patch };
  }

  const titleMaxCandidates = [
    base?.titleMaxChars,
    ...overrides.map((o) => o?.titleMaxChars).filter((n): n is number => n != null),
  ].filter((n): n is number => n != null);

  if (titleMaxCandidates.length > 0) {
    merged.titleMaxChars = Math.min(...titleMaxCandidates);
  }

  if (
    merged.titleMinChars != null
    && merged.titleMaxChars != null
    && merged.titleMinChars > merged.titleMaxChars
  ) {
    const { titleMinChars: _drop, ...rest } = merged;
    merged = rest;
  }

  return Object.keys(merged).length > 0 ? merged : base;
}

export function formatHardCharacterLimitsForPrompt(rules?: ContentMarketplaceRules | null): string {
  if (!rules) return "";
  const lines: string[] = ["--- NON-NEGOTIABLE CHARACTER LIMITS (count spaces; validate before returning JSON) ---"];
  if (rules.titleMaxChars != null) {
    lines.push(
      `Title: MUST be at most ${rules.titleMaxChars} characters including spaces. If your draft is longer, shorten it — do not return a longer title.`,
    );
  }
  if (rules.titleMinChars != null) {
    lines.push(`Title: at least ${rules.titleMinChars} characters when possible without exceeding the maximum.`);
  }
  if (rules.bulletCount != null) {
    lines.push(`Bullets: return exactly ${rules.bulletCount} bullet points in the JSON array.`);
  }
  if (rules.bulletMaxChars != null) {
    lines.push(`Each bullet: MUST be at most ${rules.bulletMaxChars} characters including spaces.`);
  }
  if (rules.descriptionMaxWords != null) {
    lines.push(`Description HTML: MUST be at most ${rules.descriptionMaxWords} words.`);
  }
  return lines.length > 1 ? `${lines.join("\n")}\n` : "";
}

export function clampTitleToMaxChars(title: string, maxChars?: number | null): string {
  if (maxChars == null || maxChars < 1) return title;
  const trimmed = title.trim();
  if (trimmed.length <= maxChars) return trimmed;

  let cut = trimmed.slice(0, maxChars).trimEnd();
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > Math.floor(maxChars * 0.55)) {
    cut = cut.slice(0, lastSpace).trimEnd();
  }
  while (cut.length > maxChars) {
    cut = cut.slice(0, -1).trimEnd();
  }
  return cut;
}

export function clampBulletsToMaxChars(bullets: string[], maxChars?: number | null): string[] {
  if (maxChars == null || maxChars < 1) return bullets;
  return bullets.map((b) => clampTitleToMaxChars(b, maxChars));
}

/** Limits from full skill file text (header + optional prose in body). */
export function resolveLimitsFromSkillInstructionsText(
  instructionsText: string,
): Partial<ContentMarketplaceRules> {
  const header = extractSkillYamlHeader(instructionsText);
  const fromHeader = parseSkillHeaderContentLimits(header);
  const body = extractGenerationInstructionsFromSkillText(instructionsText);
  const fromProse = inferTitleMaxCharsFromProse(body);
  return mergeListingContentRules({}, fromHeader, fromProse ? { titleMaxChars: fromProse } : {}) ?? {};
}