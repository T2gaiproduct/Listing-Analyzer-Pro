import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type AgentToolName =
  | "get_seller_memory"
  | "get_amazon_listing"
  | "audit_listing"
  | "save_agent_memory";

export type AgentToolConfig = {
  toolName: AgentToolName;
  enabled: boolean;
  requiresApproval: boolean;
};

export type AgentToolDefinition = {
  name: AgentToolName;
  label: string;
  description: string;
  defaultRequiresApproval: boolean;
};

export type SellermateAgent = {
  id: number;
  name: string;
  description: string;
  systemPrompt?: string;
  icon: string;
  model: string;
  executionProvider: string;
  isDefault: boolean;
  slug: string | null;
  createdAt: string;
  tools: AgentToolConfig[];
};

export type SellermateThread = {
  id: number;
  agentId: number;
  title: string;
  lastMessageAt: string | null;
  createdAt: string;
};

export type SellermateMessage = {
  id: number;
  threadId: number;
  role: "user" | "assistant" | string;
  content: string;
  createdAt: string;
};

export type SellermateMemory = {
  id: number;
  agentId: number;
  name: string;
  description?: string;
  content: string;
  createdAt: string;
};

export async function fetchAgentToolsCatalog(): Promise<{
  tools: AgentToolDefinition[];
  models: string[];
}> {
  return fetchJson(`${basePath}/api/sellermate/tools-catalog`);
}

export async function fetchSellermateAgents(): Promise<SellermateAgent[]> {
  const data = await fetchJson<{ agents: SellermateAgent[] }>(`${basePath}/api/sellermate/agents`);
  return data.agents;
}

export async function createSellermateAgent(input: {
  name: string;
  description?: string;
  systemPrompt: string;
  model?: string;
  tools?: AgentToolConfig[];
}): Promise<SellermateAgent> {
  const data = await fetchJson<{ agent: SellermateAgent }>(`${basePath}/api/sellermate/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.agent;
}

export async function duplicateSellermateAgent(agentId: number, name?: string): Promise<SellermateAgent> {
  const data = await fetchJson<{ agent: SellermateAgent }>(`${basePath}/api/sellermate/agents/${agentId}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return data.agent;
}

export async function deleteSellermateAgent(agentId: number): Promise<void> {
  await fetchJson(`${basePath}/api/sellermate/agents/${agentId}`, { method: "DELETE" });
}

export async function updateSellermateAgent(
  agentId: number,
  input: {
    name: string;
    description?: string;
    systemPrompt: string;
    model?: string;
    tools?: AgentToolConfig[];
  },
): Promise<SellermateAgent> {
  const data = await fetchJson<{ agent: SellermateAgent }>(`${basePath}/api/sellermate/agents/${agentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.agent;
}

export async function fetchSellermateThreads(agentId: number): Promise<SellermateThread[]> {
  const data = await fetchJson<{ threads: SellermateThread[] }>(`${basePath}/api/sellermate/agents/${agentId}/threads`);
  return data.threads;
}

export async function fetchSellermateMessages(threadId: number): Promise<SellermateMessage[]> {
  const data = await fetchJson<{ messages: SellermateMessage[] }>(`${basePath}/api/sellermate/threads/${threadId}/messages`);
  return data.messages;
}

export async function sendSellermateChat(input: {
  agentId: number;
  message: string;
  threadId?: number;
  mode?: "basic" | "agent";
}): Promise<{
  thread: SellermateThread;
  userMessage: SellermateMessage;
  assistantMessage: SellermateMessage;
}> {
  return fetchJson(`${basePath}/api/sellermate/agents/${input.agentId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      threadId: input.threadId,
      mode: input.mode ?? "agent",
    }),
  });
}

export async function fetchSellermateMemory(agentId: number): Promise<SellermateMemory[]> {
  const data = await fetchJson<{ memory: SellermateMemory[] }>(`${basePath}/api/sellermate/agents/${agentId}/memory`);
  return data.memory;
}

export async function addSellermateMemory(agentId: number, input: { name: string; description?: string; content: string }): Promise<SellermateMemory> {
  const data = await fetchJson<{ memory: SellermateMemory }>(`${basePath}/api/sellermate/agents/${agentId}/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.memory;
}

export async function uploadSellermateMemoryFile(
  agentId: number,
  input: { name: string; description?: string; filename: string; fileBase64: string },
): Promise<SellermateMemory> {
  const data = await fetchJson<{ memory: SellermateMemory }>(`${basePath}/api/sellermate/agents/${agentId}/memory/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return data.memory;
}

export async function deleteSellermateMemory(agentId: number, memoryId: number): Promise<void> {
  await fetchJson(`${basePath}/api/sellermate/agents/${agentId}/memory/${memoryId}`, { method: "DELETE" });
}
