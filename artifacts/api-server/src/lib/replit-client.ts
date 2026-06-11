import { openai } from "@workspace/integrations-openai-ai-server";
import type OpenAI from "openai";

export function getReplitClient(): OpenAI {
  return openai;
}
