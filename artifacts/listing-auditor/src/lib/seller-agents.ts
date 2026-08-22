const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

export type SellerAgent = {
  id: number;
  workspaceId: number;
  name: string;
  description: string | null;
  instructions: string;
  icon: string;
  isDefault: boolean;
  isPlatformTemplate: boolean;
  mode: "basic" | "agent" | string;
  enabledSkills: string[];
  learnFromWorkspace: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SellerAgentChat = {
  id: number;
  agentId: number;
  workspaceId: number;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type SellerAgentMessage = {
  id: number;
  chatId: number;
  agentId: number;
  role: "user" | "assistant" | "system" | string;
  content: string;
  createdAt: string;
};

export type SellerAgentMemoryFile = {
  id: number;
  agentId: number;
  workspaceId: number;
  fileName: string;
  mimeType: string | null;
  byteSize: number;
  source: string;
  createdAt: string;
};

export async function fetchSellerAgents(): Promise<{ agents: SellerAgent[] }> {
  return fetchJson(`${basePath}/api/seller-agents`);
}

export async function createSellerAgent(input: {
  name: string;
  description?: string;
  instructions: string;
  mode?: "basic" | "agent";
  enabledSkills?: string[];
}): Promise<{ agent: SellerAgent }> {
  return fetchJson(`${basePath}/api/seller-agents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateSellerAgent(
  agentId: number,
  input: Partial<{
    name: string;
    description: string;
    instructions: string;
    mode: "basic" | "agent";
    enabledSkills: string[];
    learnFromWorkspace: boolean;
  }>,
): Promise<{ agent: SellerAgent }> {
  return fetchJson(`${basePath}/api/seller-agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function cloneSellerAgent(agentId: number): Promise<{ agent: SellerAgent }> {
  return fetchJson(`${basePath}/api/seller-agents/${agentId}/clone`, { method: "POST" });
}

export async function fetchSellerAgentChats(agentId: number): Promise<{ chats: SellerAgentChat[] }> {
  return fetchJson(`${basePath}/api/seller-agents/${agentId}/chats`);
}

export async function createSellerAgentChat(agentId: number, title?: string): Promise<{ chat: SellerAgentChat }> {
  return fetchJson(`${basePath}/api/seller-agents/${agentId}/chats`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function fetchSellerAgentMessages(
  agentId: number,
  chatId: number,
): Promise<{ messages: SellerAgentMessage[] }> {
  return fetchJson(`${basePath}/api/seller-agents/${agentId}/chats/${chatId}/messages`);
}

export async function sendSellerAgentMessage(
  agentId: number,
  chatId: number,
  content: string,
): Promise<{ userMessage: SellerAgentMessage; assistantMessage: SellerAgentMessage }> {
  return fetchJson(`${basePath}/api/seller-agents/${agentId}/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function fetchSellerAgentMemoryFiles(
  agentId: number,
): Promise<{ files: SellerAgentMemoryFile[] }> {
  return fetchJson(`${basePath}/api/seller-agents/${agentId}/memory-files`);
}

export async function uploadSellerAgentMemoryFile(
  agentId: number,
  input: { fileName: string; content: string; mimeType?: string },
): Promise<{ fileId: number; chunkCount: number }> {
  return fetchJson(`${basePath}/api/seller-agents/${agentId}/memory-files`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function indexWorkspaceForAgent(agentId: number): Promise<{ chunkCount: number }> {
  return fetchJson(`${basePath}/api/seller-agents/${agentId}/memory-files/index-workspace`, {
    method: "POST",
  });
}

export async function deleteSellerAgentMemoryFile(agentId: number, fileId: number): Promise<void> {
  await fetchJson(`${basePath}/api/seller-agents/${agentId}/memory-files/${fileId}`, {
    method: "DELETE",
  });
}
