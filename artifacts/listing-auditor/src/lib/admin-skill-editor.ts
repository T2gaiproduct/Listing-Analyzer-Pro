/** Skill type slug — must exist in admin Skill types registry (ai_skill_types). */
export type SkillType = string;

export const DEFAULT_SKILL_TYPE_SLUG = "product_content";

export const DEFAULT_LISTING_AUDIT_SKILL_TEXT = `name: Global listing audit
title_weight: 25
bullet_weight: 25
image_weight: 25
keyword_weight: 25
show_title: yes
show_bullets: yes
show_images: yes
show_keywords: yes
score_offset: 0
score_floor: 0
score_ceiling: 100

# Generation instructions
Score title, bullets, images, and keywords for marketplace listings. Be specific in issues and suggestions.
Use stricter scoring for regulated categories (supplements, baby, medical claims) when the product category implies it.`;

export type SkillInstructions = {
  name: string;
  titleMax: number;
  bulletCount: number;
  bulletMax: number;
  descMax: number;
  tone: string;
  banned: string[];
};

export const DEFAULT_SKILL_INSTRUCTIONS_TEXT = `name: New skill
title_max: 150
bullets: 5
bullet_max: 200
desc_max: 500
tone: Neutral
banned: best, guaranteed`;

export const SAMPLE_PRODUCTS = [
  {
    id: "mr7c",
    label: "MR7C · Glutathione Skin Health Support & Antioxidant",
    category: "Nutritional Supplement",
    title:
      "MR7C Glutathione Skin Health Support & Antioxidant, Collagen Synthesis, 30 Tablets",
    bullets: [
      "Skin Health Support — formula contains glutathione, hyaluronic acid, and S-Acetyl Glutathione for a healthy glow.",
      "Antioxidant Protection — antioxidant blend helps defend skin against oxidative stress from the environment.",
      "Essential Collagen Synthesis Nutrients — includes Vitamin C and other nutrients that support collagen formation.",
      "Easy Daily Routine — one tablet format for straightforward daily use.",
      "Balanced Formula — developed for adults seeking skin health and antioxidant support in a convenient tablet.",
    ],
    description:
      "This daily glutathione tablet brings together antioxidants and skin-supporting nutrients in a simple once-a-day routine. Each serving is designed for adults who want antioxidant protection and ingredients that support collagen synthesis — without a complicated regimen.",
  },
  {
    id: "bottle",
    label: "Summit Trail · Insulated Water Bottle 32oz",
    category: "Sport Table Game",
    title: "Summit Trail 32oz Insulated Stainless Steel Water Bottle — Matte Black",
    bullets: [
      "Double-wall vacuum insulation keeps drinks cold up to 24 hours.",
      "Leak-proof sport lid is gym-bag and commute friendly.",
      "Wide mouth fits ice cubes and makes cleaning easy.",
      "BPA-free 18/8 stainless steel with durable powder coat.",
      "Fits most standard vehicle cup holders.",
    ],
    description:
      "Stay hydrated on the trail or at your desk with this 32oz insulated bottle. The vacuum-sealed body helps maintain temperature while the powder-coated exterior stands up to daily use.",
  },
] as const;

export function parseSkillInstructions(text: string): SkillInstructions {
  const out: SkillInstructions = {
    name: "New skill",
    titleMax: 150,
    bulletCount: 5,
    bulletMax: 200,
    descMax: 500,
    tone: "Neutral",
    banned: [],
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    switch (key) {
      case "name":
        out.name = value || out.name;
        break;
      case "title_max":
        out.titleMax = Number(value) || out.titleMax;
        break;
      case "bullets":
        out.bulletCount = Number(value) || out.bulletCount;
        break;
      case "bullet_max":
        out.bulletMax = Number(value) || out.bulletMax;
        break;
      case "desc_max":
        out.descMax = Number(value) || out.descMax;
        break;
      case "tone":
        out.tone = value || out.tone;
        break;
      case "banned":
        out.banned = value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        break;
      default:
        break;
    }
  }

  return out;
}

export type SkillTestOutput = {
  title: string;
  titleCount: number;
  titleMax: number;
  bullets: string[];
  description: string;
  bannedFound: string[];
  modelLabel: string;
  sampleCategory: string;
};

function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function runSkillTest(params: {
  instructionsText: string;
  sampleProductId: string;
  aiModel: string;
}): SkillTestOutput {
  const rules = parseSkillInstructions(params.instructionsText);
  const product = SAMPLE_PRODUCTS.find((p) => p.id === params.sampleProductId) ?? SAMPLE_PRODUCTS[0];
  const title = clampText(product.title, rules.titleMax);
  const bullets = product.bullets
    .slice(0, Math.max(1, rules.bulletCount))
    .map((b) => clampText(b, rules.bulletMax));
  const description = clampText(product.description, rules.descMax);

  const haystack = `${title} ${bullets.join(" ")} ${description}`.toLowerCase();
  const bannedFound = rules.banned.filter((term) => haystack.includes(term));

  return {
    title,
    titleCount: title.length,
    titleMax: rules.titleMax,
    bullets,
    description,
    bannedFound,
    modelLabel: params.aiModel,
    sampleCategory: product.category,
  };
}
