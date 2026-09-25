import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateImageBuffer } from "./openai-image.js";
import { getCreditCost, hasCreditsTeamAware, deductCreditsTeamAware, insufficientCreditsMessage, type TeamAwareContext } from "./credits.js";
import { IMAGES_DIR } from "./image-storage.js";

const VARIANT_STYLE_SUFFIXES = [
  "Clean Amazon main-image style, white background, product centered, professional lighting.",
  "Lifestyle context, natural setting, aspirational mood, soft daylight.",
  "Bold composition, high contrast, eye-catching hero shot for mobile shoppers.",
];

export type SellermateImageVariant = {
  id: string;
  imageUrl: string;
  title: string;
  summary: string;
};

function sellermateImageDir(workspaceId: number): string {
  return path.join(IMAGES_DIR, "sellermate", String(workspaceId));
}

export function sellermateImagePublicUrl(workspaceId: number, filename: string): string {
  return `/api/sellermate/images/${workspaceId}/${filename}`;
}

export function resolveSellermateImagePath(workspaceId: number, filename: string): string | null {
  const safe = path.basename(filename);
  if (!safe || safe.includes("..")) return null;
  const resolved = path.join(sellermateImageDir(workspaceId), safe);
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

export async function generateSellermateImageVariants(input: {
  workspaceId: number;
  creditCtx: TeamAwareContext;
  prompt: string;
  count?: number;
}): Promise<{ variants: SellermateImageVariant[]; creditsUsed: number }> {
  const basePrompt = input.prompt.trim();
  if (!basePrompt) {
    throw new Error("prompt is required.");
  }

  const count = Math.min(3, Math.max(2, input.count ?? 3));
  const cost = await getCreditCost("image_regenerate");
  const creditsNeeded = cost.creditsRequired * count;

  const hasCredits = await hasCreditsTeamAware(input.creditCtx, cost.creditType, creditsNeeded);
  if (!hasCredits) {
    throw new Error(await insufficientCreditsMessage(input.creditCtx, cost.creditType, creditsNeeded));
  }

  const dir = sellermateImageDir(input.workspaceId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const variants: SellermateImageVariant[] = [];

  for (let i = 0; i < count; i++) {
    const id = `ex${i + 1}`;
    const styleHint = VARIANT_STYLE_SUFFIXES[i % VARIANT_STYLE_SUFFIXES.length];
    const fullPrompt = `${basePrompt}\n\nStyle direction: ${styleHint}`;
    const buffer = await generateImageBuffer(fullPrompt, "1024x1024");
    const filename = `${randomUUID()}.png`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);

    variants.push({
      id,
      imageUrl: sellermateImagePublicUrl(input.workspaceId, filename),
      title: `Variation ${i + 1}`,
      summary: styleHint.split(",")[0] ?? `Option ${i + 1}`,
    });
  }

  await deductCreditsTeamAware(
    input.creditCtx,
    cost.creditType,
    creditsNeeded,
    `SellerLens AI image variants (${count})`,
    "image_regenerate",
    { workspaceId: input.workspaceId, variantCount: count },
  );

  return { variants, creditsUsed: creditsNeeded };
}
