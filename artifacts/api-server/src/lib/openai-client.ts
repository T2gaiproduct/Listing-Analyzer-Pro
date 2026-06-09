import OpenAI from "openai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let cachedClient: OpenAI | null = null;
let cachedKey: string | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "openai_api_key"));

  const apiKey = setting?.value ?? "";

  if (!apiKey) {
    throw new Error(
      "OpenAI API key is not configured. Please set it in Admin Settings > AI Settings.",
    );
  }

  if (cachedClient && cachedKey === apiKey) {
    return cachedClient;
  }

  const baseUrl =
    (await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "openai_base_url")))[0]?.value ??
    "https://api.openai.com/v1";

  cachedClient = new OpenAI({ apiKey, baseURL: baseUrl });
  cachedKey = apiKey;
  return cachedClient;
}

export function clearOpenAICache(): void {
  cachedClient = null;
  cachedKey = null;
}
