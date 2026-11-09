/** Server-side skill test preview (mirrors listing-auditor admin-skill-editor). */

export type SkillTestOutput = {
  title: string;
  titleCount: number;
  titleMax: number;
  bullets: string[];
  description: string;
  bannedFound: string[];
  modelLabel: string;
  sampleCategory: string;
  tone: string;
  bannedCount: number;
};

const SAMPLE_PRODUCTS = [
  {
    id: "mr7c",
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

function parseInstructions(text: string) {
  const out = {
    titleMax: 150,
    bulletCount: 5,
    bulletMax: 200,
    descMax: 500,
    tone: "Neutral",
    banned: [] as string[],
  };
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    switch (key) {
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

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function runAdminSkillTest(params: {
  instructionsText: string;
  sampleProductId?: string;
  aiModel?: string;
}): SkillTestOutput {
  const rules = parseInstructions(params.instructionsText);
  const product =
    SAMPLE_PRODUCTS.find((p) => p.id === params.sampleProductId) ?? SAMPLE_PRODUCTS[0];
  const title = clamp(product.title, rules.titleMax);
  const bullets = product.bullets
    .slice(0, Math.max(1, rules.bulletCount))
    .map((b) => clamp(b, rules.bulletMax));
  const description = clamp(product.description, rules.descMax);
  const haystack = `${title} ${bullets.join(" ")} ${description}`.toLowerCase();
  const bannedFound = rules.banned.filter((t) => haystack.includes(t));

  return {
    title,
    titleCount: title.length,
    titleMax: rules.titleMax,
    bullets,
    description,
    bannedFound,
    modelLabel: params.aiModel?.trim() || "Claude Sonnet 5.5",
    sampleCategory: product.category,
    tone: rules.tone,
    bannedCount: rules.banned.length,
  };
}

export function listAdminSkillSampleProducts() {
  return SAMPLE_PRODUCTS.map((p) => ({ id: p.id, label: p.id === "mr7c"
    ? "MR7C · Glutathione Skin Health Support & Antioxidant"
    : "Summit Trail · Insulated Water Bottle 32oz" }));
}
