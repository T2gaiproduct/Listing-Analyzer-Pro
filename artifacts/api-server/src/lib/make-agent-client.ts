export type MakeAgentWebhookPayload = {
  workspaceId: number;
  agentId: number;
  threadId: number;
  conversationId: string | null;
  userId: string;
  message: string;
  mode: "basic" | "agent";
};

export type MakeAgentWebhookResponse = {
  response: string;
  externalConversationId?: string | null;
};

function getMakeWebhookUrl(): string | null {
  const url = process.env.MAKE_AGENT_WEBHOOK_URL?.trim();
  return url || null;
}

export function isMakeExecutionEnabled(): boolean {
  const provider = process.env.AI_AGENT_EXECUTION_PROVIDER?.trim().toLowerCase();
  if (provider === "make") return Boolean(getMakeWebhookUrl());
  return false;
}

export function shouldUseMakeForAgent(agentExecutionProvider: string): boolean {
  if (!isMakeExecutionEnabled()) return false;
  return agentExecutionProvider === "make";
}

export async function invokeMakeAgentWebhook(
  payload: MakeAgentWebhookPayload,
): Promise<MakeAgentWebhookResponse> {
  const webhookUrl = getMakeWebhookUrl();
  if (!webhookUrl) {
    throw new Error("Make agent webhook is not configured.");
  }

  const secret = process.env.MAKE_TOOL_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Make webhook failed (${response.status}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { response: text.trim() };
  }

  if (typeof parsed === "string") {
    return { response: parsed.trim() };
  }

  const body = parsed as Record<string, unknown>;
  const reply = typeof body.response === "string"
    ? body.response
    : typeof body.message === "string"
      ? body.message
      : typeof body.content === "string"
        ? body.content
        : text.trim();

  return {
    response: reply.trim(),
    externalConversationId: typeof body.externalConversationId === "string"
      ? body.externalConversationId
      : typeof body.conversationId === "string"
        ? body.conversationId
        : null,
  };
}
