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
  return options.slice(0, 4).map((option, index) => ({
    id: option.id?.trim() || `ex${index + 1}`,
    title: stripChatMarkdown(option.title?.trim() || `Example ${index + 1}`),
    summary: stripChatMarkdown(option.summary?.trim() || ""),
    content: stripChatMarkdown(option.content?.trim() || option.summary?.trim() || ""),
  }));
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
3. **Presenting options** — When recommending strategies, titles, campaigns, or creative directions, set phase to "presenting_options" and provide 2–4 distinct options (ids: ex1, ex2, ex3, ex4). Each option needs a title, one-line summary, and detailed content.
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
  "options": [{"id":"ex1","title":"...","summary":"...","content":"..."}],
  "requestTools": ["optional tool names to call before final answer"]
}

Keep message concise. Options must be meaningfully different.
Use plain text only in message, questions, and options — no markdown, no ** bold, no asterisks for emphasis.`);
  } else {
    parts.push("\n\nAnswer concisely and helpfully. Use prior conversation context when relevant.");
  }

  return parts.join("\n");
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
    return {
      content: content.trim() || "I could not generate a response. Please try again.",
      metadata: { phase: "response" },
    };
  }

  const toolsUsed: string[] = [];
  const requestedTools = (orchestration.requestTools ?? [])
    .filter((name): name is AgentToolName => isValidAgentToolName(name) && enabledToolSet.has(name as AgentToolName))
    .filter((name) => name !== "get_seller_memory" || input.memoryFileCount > 0) as AgentToolName[];

  if (requestedTools.length > 0) {
    const toolResults: string[] = [];
    for (const toolName of requestedTools) {
      if (!enabledToolSet.has(toolName)) {
        continue;
      }
      try {
        const result = await executeSellermateAgentTool(toolName, {}, {
          workspaceId: input.workspaceId,
          agentId: input.agent.id,
          userId: input.userId,
        });
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

  const metadata: SellermateMessageMetadata = {
    phase: orchestration.phase,
    questions: orchestration.phase === "clarifying"
      ? orchestration.questions?.slice(0, 3).map(stripChatMarkdown)
      : undefined,
    options: orchestration.phase === "presenting_options" ? normalizeOptions(orchestration.options) : undefined,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
  };

  return {
    content: stripChatMarkdown(orchestration.message.trim()),
    metadata,
  };
}

export function metadataToDb(metadata: SellermateMessageMetadata | null): string | null {
  return metadata ? serializeSellermateMessageMetadata(metadata) : null;
}
