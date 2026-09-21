import type { SellermateAgent } from "@workspace/db";
import { isValidAgentToolName, type AgentToolName } from "./agent-registry.js";
import { generateChatCompletion } from "./ai-provider.js";
import { executeSellermateAgentTool } from "./sellermate-agent-tools-internal.js";
import {
  parseOrchestratorResponse,
  serializeSellermateMessageMetadata,
  stripChatMarkdown,
  type SellermateMessageMetadata,
  type SellermateOrchestratorResponse,
  type SellermateResultOption,
} from "./sellermate-message-types.js";
import { getEnabledAgentToolNames } from "./workspace-agents.js";
import { parseSellermateMessageMetadata } from "./sellermate-message-types.js";
import { extractAmazonListingToolArgs } from "./sellermate-listing-tool-args.js";

const MAX_HISTORY_MESSAGES = 30;

type HistoryRow = {
  id?: number;
  role: string;
  content: string;
  metadata: string | null;
};

export type NativeAgentRunInput = {
  agent: SellermateAgent;
  workspaceId: number;
  userId: string;
  message: string;
  mode?: "basic" | "agent";
  history: HistoryRow[];
  memoryFileCount: number;
  selectedOptionId?: string;
  replyToMessageId?: number;
};

export type NativeAgentRunResult = {
  content: string;
  metadata: SellermateMessageMetadata | null;
};

function normalizeOptions(options: SellermateResultOption[] | undefined): SellermateResultOption[] {
  if (!options?.length) return [];
  return options.slice(0, 3).map((option, index) => ({
    id: option.id?.trim() || `ex${index + 1}`,
    title: stripChatMarkdown(option.title?.trim() || `Example ${index + 1}`),
    summary: stripChatMarkdown(option.summary?.trim() || ""),
    content: stripChatMarkdown(option.content?.trim() || option.summary?.trim() || ""),
    imageUrl: option.imageUrl?.trim() || undefined,
  }));
}

type ImageVariantRow = { id: string; imageUrl: string; title?: string; summary?: string };

function parseImageVariantsFromToolResults(toolResults: string[]): ImageVariantRow[] {
  for (const block of toolResults) {
    if (!block.includes("generate_image_variants")) continue;
    const jsonStart = block.indexOf("{");
    if (jsonStart === -1) continue;
    try {
      const parsed = JSON.parse(block.slice(jsonStart)) as {
        variants?: ImageVariantRow[];
      };
      if (Array.isArray(parsed.variants) && parsed.variants.length > 0) {
        return parsed.variants.filter((v) => v.id && v.imageUrl);
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

function applyImageVariantsToMetadata(
  metadata: SellermateMessageMetadata,
  toolResults: string[],
): SellermateMessageMetadata {
  const variants = parseImageVariantsFromToolResults(toolResults);
  if (variants.length === 0 || metadata.phase !== "presenting_options") return metadata;

  const baseOptions = metadata.options?.length
    ? metadata.options
    : variants.map((v) => ({
        id: v.id,
        title: v.title ?? v.id,
        summary: v.summary ?? "",
        content: v.summary ?? "",
      }));

  return {
    ...metadata,
    options: normalizeOptions(
      baseOptions.map((opt, index) => {
        const variant = variants.find((v) => v.id === opt.id) ?? variants[index];
        if (!variant?.imageUrl) return opt;
        return {
          ...opt,
          imageUrl: variant.imageUrl,
          title: opt.title || variant.title || opt.title,
          summary: opt.summary || variant.summary || opt.summary,
        };
      }),
    ),
  };
}

function buildTranscript(history: HistoryRow[], currentMessage: string): string {
  const recent = history
    .filter((row) => row.role === "user" || row.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES);

  const lines = recent.map((row) => {
    const meta = parseSellermateMessageMetadata(row.metadata);
    let prefix = row.role === "user" ? "User" : "Assistant";
    if (meta?.phase === "clarifying" && meta.questions?.length) {
      prefix += " (asked clarifying questions)";
    }
    if (meta?.phase === "presenting_options" && meta.options?.length) {
      const optionSummary = meta.options
        .map((opt) => `${opt.id}: ${opt.title}`)
        .join("; ");
      prefix += ` (presented options: ${optionSummary})`;
    }
    if (meta?.selectedOptionId) {
      prefix += ` (user selected ${meta.selectedOptionId})`;
    }
    return `${prefix}: ${row.content}`;
  });

  lines.push(`User: ${currentMessage}`);
  return lines.join("\n\n");
}

function buildWorkflowSystemPrompt(input: {
  agent: SellermateAgent;
  memoryFileCount: number;
  enabledTools: AgentToolName[];
  mode?: "basic" | "agent";
}): string {
  const parts = [input.agent.systemPrompt.trim()];

  if (input.mode === "agent") {
    parts.push(`
## Conversation workflow
Follow this sequence for every new user request:
1. **Clarifying** — If key details are missing (ASIN, goals, budget, style, metrics, etc.), set phase to "clarifying" and ask 1–3 focused questions. Do not guess.
2. **Executing** — Once you have enough context, analyze using your expertise. Request tools only when they add real value.
3. **Presenting options** — When recommending strategies, titles, campaigns, or creative directions, set phase to "presenting_options" and provide 2–3 distinct options (ids: ex1, ex2, ex3). Each option needs a title, one-line summary, and detailed content (full copy for listing text options).
4. **Response** — Use phase "response" for direct answers, follow-ups after the user picks an option, or when options are not appropriate.

## Memory policy
- Uploaded memory files for this agent: ${input.memoryFileCount}
- ${input.memoryFileCount > 0
  ? 'Memory IS available. Include "get_seller_memory" in requestTools when the user question depends on uploaded brand docs, spreadsheets, or preferences.'
  : 'No memory files uploaded. Do NOT reference or invent uploaded documents. Do NOT request get_seller_memory.'}

## Enabled tools
${input.enabledTools.length > 0 ? input.enabledTools.join(", ") : "none"}
Only request tools from the enabled list above. Never request disabled or unavailable tools.

## Output format
Respond with ONLY valid JSON (no markdown fences):
{
  "phase": "clarifying" | "presenting_options" | "response",
  "message": "User-facing text shown in chat",
  "questions": ["optional clarifying questions when phase is clarifying"],
  "options": [{"id":"ex1","title":"...","summary":"...","content":"...","imageUrl":"optional when tool returned URLs"}],
  "requestTools": ["optional tool names to call before final answer"]
}

Keep message concise. Options must be meaningfully different.
Use plain text only in message, questions, and options — no markdown, no ** bold, no asterisks for emphasis.`);

  const slug = input.agent.slug?.trim();
  if (slug === "image-creator") {
    parts.push(`
## Image Creator policy
When the user wants generated listing images (main image, lifestyle, hero shot, etc.), request "generate_image_variants" with a detailed prompt and count 2 or 3.
After the tool runs, use phase "presenting_options" with ids ex1, ex2, (ex3) and ask which image looks best. Include imageUrl from the tool on each matching option when provided.`);
  }
  if (slug === "generate-content") {
    parts.push(`
## Content optimization policy
When optimizing titles, bullet points, or product descriptions, always use phase "presenting_options" with 2–3 complete copy variants (not outlines). Put the full proposed text in each option's content field so the user can compare and pick the best.`);
  }
  } else {
    parts.push("\n\nAnswer concisely and helpfully. Use prior conversation context when relevant.");
  }

  return parts.join("\n");
}

function buildToolArgs(
  toolName: AgentToolName,
  transcript: string,
  listingToolArgs: { asin?: string; url?: string },
): Record<string, unknown> {
  if (toolName === "get_amazon_listing") {
    return listingToolArgs.asin || listingToolArgs.url
      ? listingToolArgs
      : extractAmazonListingToolArgs(transcript);
  }
  return {};
}

async function runOrchestrator(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<SellermateOrchestratorResponse | null> {
  const { content } = await generateChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { maxTokens, temperature: 0.35 },
  );

  return parseOrchestratorResponse(content) ?? null;
}

async function refineSelectedOption(input: {
  agent: SellermateAgent;
  transcript: string;
  selectedOption: SellermateResultOption;
  memoryFileCount: number;
}): Promise<NativeAgentRunResult> {
  const { content } = await generateChatCompletion(
    [
      {
        role: "system",
        content: `${input.agent.systemPrompt.trim()}

The user selected "${input.selectedOption.title}" (${input.selectedOption.id}).
Expand and refine ONLY that option into a clear, actionable final answer.
Uploaded memory files: ${input.memoryFileCount}. Do not reference documents unless they were discussed.`,
      },
      {
        role: "user",
        content: `${input.transcript}

Selected option details:
Title: ${input.selectedOption.title}
Summary: ${input.selectedOption.summary}
Content: ${input.selectedOption.content}
${input.selectedOption.imageUrl ? `Chosen image: ${input.selectedOption.imageUrl}` : ""}

Provide the refined final recommendation.`,
      },
    ],
    { maxTokens: 2048, temperature: 0.4 },
  );

  return {
    content: stripChatMarkdown(content.trim() || input.selectedOption.content),
    metadata: {
      phase: "response",
      selectedOptionId: input.selectedOption.id,
    },
  };
}

export async function runNativeSellermateAgent(input: NativeAgentRunInput): Promise<NativeAgentRunResult> {
  const transcript = buildTranscript(input.history, input.message);

  if (input.selectedOptionId && input.replyToMessageId) {
    const target = input.history.find((row) => row.id === input.replyToMessageId)
      ?? input.history.filter((row) => row.role === "assistant").at(-1);

    const meta = target ? parseSellermateMessageMetadata(target.metadata) : null;
    const selected = meta?.options?.find((opt) => opt.id === input.selectedOptionId);
    if (selected) {
      return refineSelectedOption({
        agent: input.agent,
        transcript,
        selectedOption: selected,
        memoryFileCount: input.memoryFileCount,
      });
    }
  }

  if (input.mode !== "agent") {
    const systemPrompt = buildWorkflowSystemPrompt({
      agent: input.agent,
      memoryFileCount: input.memoryFileCount,
      enabledTools: [],
      mode: "basic",
    });

    const { content } = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript ? `Conversation so far:\n${transcript}` : input.message },
      ],
      { maxTokens: 1024, temperature: 0.4 },
    );

    return {
      content: content.trim() || "I could not generate a response. Please try again.",
      metadata: null,
    };
  }

  const enabledTools = await getEnabledAgentToolNames(input.agent.id, input.workspaceId);
  const enabledToolSet = new Set<AgentToolName>(enabledTools);

  const systemPrompt = buildWorkflowSystemPrompt({
    agent: input.agent,
    memoryFileCount: input.memoryFileCount,
    enabledTools,
    mode: "agent",
  });

  const userPrompt = `Conversation so far:\n${transcript}\n\nProduce the next assistant JSON response.`;

  let orchestration = await runOrchestrator(systemPrompt, userPrompt, 2048);

  if (!orchestration) {
    const { content } = await generateChatCompletion(
      [
        { role: "system", content: input.agent.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 2048, temperature: 0.4 },
    );
    const fallback = parseOrchestratorResponse(content);
    const fallbackMessage = (fallback?.message ?? content.trim()) || "I could not generate a response. Please try again.";
    return {
      content: stripChatMarkdown(fallbackMessage),
      metadata: fallback && fallback.phase !== "response"
        ? {
            phase: fallback.phase,
            questions: fallback.questions,
            options: fallback.options ? normalizeOptions(fallback.options) : undefined,
          }
        : { phase: "response" },
    };
  }

  const toolsUsed: string[] = [];
  const listingToolArgs = enabledToolSet.has("get_amazon_listing")
    ? extractAmazonListingToolArgs(transcript)
    : {};
  const shouldAutoFetchListing = Boolean(listingToolArgs.asin || listingToolArgs.url);

  const requestedTools = [
    ...(shouldAutoFetchListing && enabledToolSet.has("get_amazon_listing") ? ["get_amazon_listing" as const] : []),
    ...(orchestration.requestTools ?? [])
      .filter((name): name is AgentToolName => isValidAgentToolName(name) && enabledToolSet.has(name as AgentToolName))
      .filter((name) => name !== "get_seller_memory" || input.memoryFileCount > 0)
      .filter((name) => name !== "get_amazon_listing" || !shouldAutoFetchListing),
  ].filter((name, index, all) => all.indexOf(name) === index) as AgentToolName[];

  const toolResults: string[] = [];
  if (requestedTools.length > 0) {
    for (const toolName of requestedTools) {
      if (!enabledToolSet.has(toolName)) {
        continue;
      }
      try {
        const result = await executeSellermateAgentTool(
          toolName,
          buildToolArgs(toolName, transcript, listingToolArgs),
          {
            workspaceId: input.workspaceId,
            agentId: input.agent.id,
            userId: input.userId,
            creditCtx: {
              userId: input.userId,
              workspaceId: input.workspaceId,
            },
          },
        );
        toolResults.push(`Tool ${toolName}:\n${result}`);
        toolsUsed.push(toolName);
      } catch (err) {
        toolResults.push(`Tool ${toolName} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const followUp = await runOrchestrator(
      systemPrompt,
      `${userPrompt}\n\nTool results:\n${toolResults.join("\n\n")}\n\nNow produce the final JSON response incorporating tool results.`,
      2048,
    );
    if (followUp) orchestration = followUp;
  }

  let metadata: SellermateMessageMetadata = {
    phase: orchestration.phase,
    questions: orchestration.phase === "clarifying"
      ? orchestration.questions?.slice(0, 3).map(stripChatMarkdown)
      : undefined,
    options: orchestration.phase === "presenting_options" ? normalizeOptions(orchestration.options) : undefined,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
  };

  if (toolResults.length > 0) {
    metadata = applyImageVariantsToMetadata(metadata, toolResults);
  }

  return {
    content: stripChatMarkdown(orchestration.message.trim()),
    metadata,
  };
}

export function metadataToDb(metadata: SellermateMessageMetadata | null): string | null {
  return metadata ? serializeSellermateMessageMetadata(metadata) : null;
}
