import Anthropic from "@anthropic-ai/sdk";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_CHAT_MODEL = "claude-sonnet-4-20250514";

let cachedClient: Anthropic | null = null;
let cachedKey: string | null = null;

export async function getClaudeChatModel(): Promise<string> {
  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "claude_chat_model"))
    .limit(1);
  const model = setting?.value?.trim();
  return model || DEFAULT_CHAT_MODEL;
}

export async function getClaudeClient(): Promise<Anthropic> {
  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "claude_api_key"))
    .limit(1);

  const apiKey = setting?.value ?? "";

  if (!apiKey) {
    throw new Error(
      "Claude API key is not configured. Please set it in Admin Settings > AI Settings.",
    );
  }

  if (cachedClient && cachedKey === apiKey) {
    return cachedClient;
  }

  cachedClient = new Anthropic({ apiKey });
  cachedKey = apiKey;
  return cachedClient;
}

export function clearClaudeCache(): void {
  cachedClient = null;
  cachedKey = null;
}

export { DEFAULT_CHAT_MODEL as CLAUDE_DEFAULT_CHAT_MODEL };
