import type { AiUseCase } from "./ai-use-cases.js";
import {
  getCustomProviderById,
  loadCustomProviders,
  loadUseCaseRouting,
  resolveAiBackend,
} from "./ai-custom-providers.js";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { customProviderApiKeySettingKey } from "./ai-use-cases.js";
import type { AIProvider } from "./ai-provider-types.js";

export type SkillChatModelOption = {
  value: string;
  label: string;
  detail: string;
};

const BUILTIN_CHAT: Record<AIProvider, { label: string; model: string }> = {
  openai: { label: "OpenAI", model: "gpt-5.4" },
  gemini: { label: "Google Gemini", model: "gemini-2.5-flash" },
  replit: { label: "Replit AI", model: "gpt-5.4" },
};

export function skillTypeToAiUseCase(skillType: string): AiUseCase {
  if (skillType === "listing_audit") return "listing_audit";
  if (skillType === "product_images") return "image_generation";
  if (skillType === "aplus_content") return "aplus_content";
  return "content_generation";
}

function routeToOptionLabel(route: string): string {
  if (route === "openai" || route === "gemini" || route === "replit") {
    const meta = BUILTIN_CHAT[route];
    return `${meta.label} (${meta.model})`;
  }
  if (route.startsWith("custom:")) return route;
  return route;
}

export async function describeResolvedAiSettingsRoute(useCase: AiUseCase): Promise<string> {
  const backend = await resolveAiBackend(useCase);
  if (backend.mode === "custom") {
    return `${backend.profile.label} · ${backend.profile.chatModel}`;
  }
  const meta = BUILTIN_CHAT[backend.provider];
  return `${meta.label} · ${meta.model}`;
}

export async function listSkillChatModelOptions(useCase: AiUseCase): Promise<{
  options: SkillChatModelOption[];
  settingsDefaultDetail: string;
}> {
  const routing = await loadUseCaseRouting();
  const routeKey = routing[useCase];
  const settingsDefaultDetail = await describeResolvedAiSettingsRoute(useCase);

  const options: SkillChatModelOption[] = [
    {
      value: "",
      label: "Use AI Settings",
      detail:
        routeKey && routeKey !== "default"
          ? `Routed to ${routeToOptionLabel(routeKey.replace(/^custom:/, "custom:"))} for this feature (${settingsDefaultDetail})`
          : `Uses global AI provider (${settingsDefaultDetail})`,
    },
  ];

  for (const id of ["openai", "gemini", "replit"] as const) {
    const meta = BUILTIN_CHAT[id];
    options.push({
      value: `route:${id}`,
      label: meta.label,
      detail: `Chat model: ${meta.model}`,
    });
  }

  const customs = await loadCustomProviders();
  for (const p of customs) {
    options.push({
      value: `route:custom:${p.id}`,
      label: p.label,
      detail: `Chat model: ${p.chatModel}${p.useCases.length ? ` · use cases: ${p.useCases.join(", ")}` : ""}`,
    });
  }

  return { options, settingsDefaultDetail };
}

/** Stored on ai_skills.ai_model: empty = AI settings; route:* = override backend. */
export async function resolveSkillChatBackend(
  skillAiModel: string | undefined | null,
): Promise<Awaited<ReturnType<typeof resolveAiBackend>> | null> {
  const raw = skillAiModel?.trim() ?? "";
  if (!raw) return null;

  if (raw.startsWith("route:")) {
    const route = raw.slice("route:".length);
    if (route === "openai" || route === "gemini" || route === "replit") {
      return { mode: "builtin", provider: route };
    }
    if (route.startsWith("custom:")) {
      const id = route.slice("custom:".length);
      const profile = await getCustomProviderById(id);
      if (!profile) return null;
      const [row] = await db
        .select()
        .from(settingsTable)
        .where(eq(settingsTable.key, customProviderApiKeySettingKey(id)))
        .limit(1);
      const apiKey = row?.value?.trim() ?? "";
      if (apiKey) return { mode: "custom", profile, apiKey };
    }
  }

  return null;
}
