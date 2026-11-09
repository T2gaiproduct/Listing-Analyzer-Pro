export const AI_USE_CASES = [
  "listing_audit",
  "content_generation",
  "image_generation",
  "aplus_content",
  "agents",
] as const;

export type AiUseCase = (typeof AI_USE_CASES)[number];

export const AI_USE_CASE_LABELS: Record<AiUseCase, string> = {
  listing_audit: "Listing audits",
  content_generation: "Listing content generation",
  image_generation: "Product & graphics images",
  aplus_content: "A+ / EBC content",
  agents: "SellerMate agents",
};

export type CustomAiProviderConfig = {
  id: string;
  label: string;
  baseUrl: string;
  chatModel: string;
  imageModel?: string;
  /** When set, these use cases route to this profile (unless overridden in routing map). */
  useCases: AiUseCase[];
};

export type UseCaseRouting = Partial<Record<AiUseCase, string>>;

/** `default` | `openai` | `gemini` | `replit` | `custom:<id>` */
export function parseUseCaseRouting(raw: string | undefined): UseCaseRouting {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: UseCaseRouting = {};
    for (const uc of AI_USE_CASES) {
      const v = parsed[uc];
      if (typeof v === "string" && v.trim()) out[uc] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function parseCustomProviders(raw: string | undefined): CustomAiProviderConfig[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: CustomAiProviderConfig[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id.trim() : "";
      const label = typeof o.label === "string" ? o.label.trim() : "";
      const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
      const chatModel = typeof o.chatModel === "string" ? o.chatModel.trim() : "";
      if (!id || !label || !baseUrl || !chatModel) continue;
      const imageModel = typeof o.imageModel === "string" ? o.imageModel.trim() : undefined;
      const useCases = Array.isArray(o.useCases)
        ? o.useCases.filter((u): u is AiUseCase =>
            typeof u === "string" && (AI_USE_CASES as readonly string[]).includes(u),
          )
        : [];
      out.push({ id, label, baseUrl, chatModel, imageModel: imageModel || undefined, useCases });
    }
    return out;
  } catch {
    return [];
  }
}

export function slugifyProviderId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `provider-${Date.now().toString(36)}`;
}

export function customProviderApiKeySettingKey(id: string): string {
  return `custom_ai_${id}_api_key`;
}
