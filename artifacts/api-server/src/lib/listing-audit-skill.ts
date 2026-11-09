import { and, desc, eq } from "drizzle-orm";
import { aiSkillsTable, db, type AuditResult } from "@workspace/db";
import { extractGenerationInstructionsFromSkillText } from "./content-marketplace-skill-sync.js";

export type ListingAuditSkillConfig = {
  rubricAddon: string;
  weights: { title: number; bullet: number; image: number; keyword: number };
  show: { title: boolean; bullet: boolean; image: boolean; keyword: boolean };
  scoreOffset: number;
  scoreFloor: number;
  scoreCeiling: number;
  aiModel: string;
};

const DEFAULT_CONFIG: ListingAuditSkillConfig = {
  rubricAddon: "",
  weights: { title: 25, bullet: 25, image: 25, keyword: 25 },
  show: { title: true, bullet: true, image: true, keyword: true },
  scoreOffset: 0,
  scoreFloor: 0,
  scoreCeiling: 100,
  aiModel: "",
};

function parseYesNo(value: string, fallback: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (v === "yes" || v === "true" || v === "1" || v === "on") return true;
  if (v === "no" || v === "false" || v === "0" || v === "off") return false;
  return fallback;
}

function parseWeight(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function parseListingAuditSkillInstructions(instructionsText: string): ListingAuditSkillConfig {
  const cfg: ListingAuditSkillConfig = {
    ...DEFAULT_CONFIG,
    rubricAddon: extractGenerationInstructionsFromSkillText(instructionsText),
  };

  for (const rawLine of instructionsText.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    switch (key) {
      case "title_weight":
        cfg.weights.title = parseWeight(value, cfg.weights.title);
        break;
      case "bullet_weight":
        cfg.weights.bullet = parseWeight(value, cfg.weights.bullet);
        break;
      case "image_weight":
        cfg.weights.image = parseWeight(value, cfg.weights.image);
        break;
      case "keyword_weight":
        cfg.weights.keyword = parseWeight(value, cfg.weights.keyword);
        break;
      case "show_title":
        cfg.show.title = parseYesNo(value, cfg.show.title);
        break;
      case "show_bullets":
        cfg.show.bullet = parseYesNo(value, cfg.show.bullet);
        break;
      case "show_images":
        cfg.show.image = parseYesNo(value, cfg.show.image);
        break;
      case "show_keywords":
        cfg.show.keyword = parseYesNo(value, cfg.show.keyword);
        break;
      case "score_offset":
        cfg.scoreOffset = Number(value) || 0;
        break;
      case "score_floor":
        cfg.scoreFloor = parseWeight(value, cfg.scoreFloor);
        break;
      case "score_ceiling":
        cfg.scoreCeiling = parseWeight(value, cfg.scoreCeiling);
        break;
      default:
        break;
    }
  }

  return cfg;
}

function clampScore(n: number, floor: number, ceiling: number): number {
  return Math.min(ceiling, Math.max(floor, Math.round(n)));
}

function adjustSectionScore(score: number, cfg: ListingAuditSkillConfig): number {
  return clampScore(score + cfg.scoreOffset, cfg.scoreFloor, cfg.scoreCeiling);
}

export function applyListingAuditSkillToResult(result: AuditResult, cfg: ListingAuditSkillConfig): AuditResult {
  const title = adjustSectionScore(result.titleScore.score, cfg);
  const bullet = adjustSectionScore(result.bulletScore.score, cfg);
  const image = adjustSectionScore(result.imageScore.score, cfg);
  const keyword = adjustSectionScore(result.keywordScore.score, cfg);

  const w = cfg.weights;
  const totalW = w.title + w.bullet + w.image + w.keyword || 100;
  const overallRaw =
    (title * w.title + bullet * w.bullet + image * w.image + keyword * w.keyword) / totalW;

  return {
    ...result,
    titleScore: { ...result.titleScore, score: title },
    bulletScore: { ...result.bulletScore, score: bullet },
    imageScore: { ...result.imageScore, score: image },
    keywordScore: { ...result.keywordScore, score: keyword },
    overallScore: clampScore(overallRaw, cfg.scoreFloor, cfg.scoreCeiling),
    display: {
      showTitle: cfg.show.title,
      showBullets: cfg.show.bullet,
      showImages: cfg.show.image,
      showKeywords: cfg.show.keyword,
    },
  };
}

export async function resolvePublishedListingAuditSkill(
  productCategory?: string,
): Promise<{ config: ListingAuditSkillConfig; skillSlug: string | null } | null> {
  const cat = productCategory?.trim() ?? "";
  const published = and(eq(aiSkillsTable.status, "published"), eq(aiSkillsTable.skillType, "listing_audit"));

  const pick = async (category: string) => {
    const [row] = await db
      .select()
      .from(aiSkillsTable)
      .where(and(published, eq(aiSkillsTable.category, category)))
      .orderBy(desc(aiSkillsTable.updatedAt))
      .limit(1);
    return row ?? null;
  };

  let row = cat ? await pick(cat) : null;
  if (!row && cat) row = await pick("Default");
  if (!row) row = await pick("");
  if (!row) {
    const [any] = await db
      .select()
      .from(aiSkillsTable)
      .where(published)
      .orderBy(desc(aiSkillsTable.updatedAt))
      .limit(1);
    row = any ?? null;
  }

  if (!row) return null;

  const config = parseListingAuditSkillInstructions(row.instructionsText);
  if (row.aiModel?.trim()) config.aiModel = row.aiModel.trim();
  return { config, skillSlug: row.slug };
}
