import { GoogleGenAI } from "@google/genai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

export async function getGeminiClient(): Promise<GoogleGenAI> {
  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "gemini_api_key"));

  const apiKey = setting?.value ?? "";

  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Please set it in Admin Settings > AI Settings.",
    );
  }

  if (cachedClient && cachedKey === apiKey) {
    return cachedClient;
  }

  cachedClient = new GoogleGenAI({ apiKey });
  cachedKey = apiKey;
  return cachedClient;
}

export function clearGeminiCache(): void {
  cachedClient = null;
  cachedKey = null;
}
