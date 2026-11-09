import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AIProvider } from "./ai-provider-types.js";

/** Claude has no image API; fall back to another configured provider for graphics. */
export async function resolveImageBuiltinProvider(
  provider: AIProvider,
): Promise<Exclude<AIProvider, "claude">> {
  if (provider !== "claude") {
    return provider;
  }

  const [openai] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "openai_api_key"))
    .limit(1);
  if (openai?.value?.trim()) {
    return "openai";
  }

  const [gemini] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "gemini_api_key"))
    .limit(1);
  if (gemini?.value?.trim()) {
    return "gemini";
  }

  throw new Error(
    "Claude does not generate images. Add an OpenAI or Gemini API key and route Product & graphics images to that provider in AI Settings.",
  );
}
