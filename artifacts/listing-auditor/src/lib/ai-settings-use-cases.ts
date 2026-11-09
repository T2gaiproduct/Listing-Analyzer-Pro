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

export type CustomAiProviderForm = {
  id: string;
  label: string;
  baseUrl: string;
  chatModel: string;
  imageModel: string;
  useCases: AiUseCase[];
  apiKey: string;
};

export function customProviderApiKeySettingKey(id: string): string {
  return `custom_ai_${id}_api_key`;
}

export function slugifyProviderId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `provider-${Date.now().toString(36)}`;
}

export function parseProvidersJson(raw: string | undefined): Omit<CustomAiProviderForm, "apiKey">[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((o) => ({
        id: String(o.id ?? ""),
        label: String(o.label ?? ""),
        baseUrl: String(o.baseUrl ?? ""),
        chatModel: String(o.chatModel ?? ""),
        imageModel: String(o.imageModel ?? ""),
        useCases: Array.isArray(o.useCases)
          ? o.useCases.filter((u): u is AiUseCase =>
              typeof u === "string" && (AI_USE_CASES as readonly string[]).includes(u),
            )
          : [],
      }))
      .filter((p) => p.id && p.label);
  } catch {
    return [];
  }
}

export function parseRoutingJson(raw: string | undefined): Partial<Record<AiUseCase, string>> {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as Partial<Record<AiUseCase, string>>;
  } catch {
    return {};
  }
}
