import OpenAI from "openai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AiUseCase } from "./ai-use-cases.js";
import {
  customProviderApiKeySettingKey,
  parseCustomProviders,
  parseUseCaseRouting,
  type CustomAiProviderConfig,
} from "./ai-use-cases.js";
import type { AIProvider } from "./ai-provider-types.js";

type BuiltinBackend = { mode: "builtin"; provider: AIProvider };
type CustomBackend = { mode: "custom"; profile: CustomAiProviderConfig; apiKey: string };
export type ResolvedAiBackend = BuiltinBackend | CustomBackend;

const SETTINGS_PROVIDERS_JSON = "ai_custom_providers_json";
const SETTINGS_ROUTING_JSON = "ai_use_case_routing_json";

let cachedProfiles: CustomAiProviderConfig[] | null = null;
let cachedRouting: ReturnType<typeof parseUseCaseRouting> | null = null;
const customClientCache = new Map<string, { key: string; client: OpenAI }>();

async function loadSettingValue(key: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return row?.value ?? "";
}

export async function loadCustomProviders(): Promise<CustomAiProviderConfig[]> {
  if (cachedProfiles) return cachedProfiles;
  const raw = await loadSettingValue(SETTINGS_PROVIDERS_JSON);
  cachedProfiles = parseCustomProviders(raw);
  return cachedProfiles;
}

export async function loadUseCaseRouting(): Promise<ReturnType<typeof parseUseCaseRouting>> {
  if (cachedRouting) return cachedRouting;
  const raw = await loadSettingValue(SETTINGS_ROUTING_JSON);
  cachedRouting = parseUseCaseRouting(raw);
  return cachedRouting;
}

export function clearCustomAiProviderCache(): void {
  cachedProfiles = null;
  cachedRouting = null;
  customClientCache.clear();
}

export async function getCustomProviderById(id: string): Promise<CustomAiProviderConfig | null> {
  const profiles = await loadCustomProviders();
  return profiles.find((p) => p.id === id) ?? null;
}

async function getCustomApiKey(id: string): Promise<string> {
  const key = customProviderApiKeySettingKey(id);
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return row?.value?.trim() ?? "";
}

async function readGlobalBuiltinProvider(): Promise<AIProvider> {
  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "ai_provider"))
    .limit(1);
  return (setting?.value ?? "openai") as AIProvider;
}

export async function resolveAiBackend(useCase?: AiUseCase): Promise<ResolvedAiBackend> {
  if (!useCase) {
    return { mode: "builtin", provider: await readGlobalBuiltinProvider() };
  }

  const routing = await loadUseCaseRouting();
  let route = routing[useCase];

  if (!route) {
    const profiles = await loadCustomProviders();
    const match = profiles.find((p) => p.useCases.includes(useCase));
    if (match) route = `custom:${match.id}`;
  }

  if (!route || route === "default") {
    return { mode: "builtin", provider: await readGlobalBuiltinProvider() };
  }

  if (route === "openai" || route === "gemini" || route === "replit") {
    return { mode: "builtin", provider: route };
  }

  if (route.startsWith("custom:")) {
    const id = route.slice("custom:".length);
    const profile = await getCustomProviderById(id);
    const apiKey = await getCustomApiKey(id);
    if (profile && apiKey) {
      return { mode: "custom", profile, apiKey };
    }
  }

  return { mode: "builtin", provider: await readGlobalBuiltinProvider() };
}

export async function getCustomOpenAIClient(
  profile: CustomAiProviderConfig,
  apiKey: string,
): Promise<OpenAI> {
  const cacheKey = profile.id;
  const hit = customClientCache.get(cacheKey);
  if (hit && hit.key === apiKey) return hit.client;

  const client = new OpenAI({ apiKey, baseURL: profile.baseUrl });
  customClientCache.set(cacheKey, { key: apiKey, client });
  return client;
}
