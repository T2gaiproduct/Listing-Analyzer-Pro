import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, sellermateAgentsTable, sellermateMemoryTable, settingsTable, workspacesTable } from "@workspace/db";
import { extractMemoryFileText } from "./sellermate-memory-file.js";

export const DEFAULT_AGENT_MEMORY_SETTINGS_KEY = "sellermate_default_agent_memory_templates";
export const DEFAULT_AGENT_MEMORY_CATEGORY = "ai";
export const ADMIN_TEMPLATE_MEMORY_KEY_PREFIX = "admin:template:";
export const ADMIN_TEMPLATE_MEMORY_USER_ID = "system:default-agent-template";

export type DefaultAgentMemoryFile = {
  id: string;
  name: string;
  description: string;
  content: string;
  memoryType: string;
};

export type DefaultAgentMemoryBySlug = Record<string, DefaultAgentMemoryFile[]>;

function parseMemoryJson(raw: string): DefaultAgentMemoryBySlug | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const result: DefaultAgentMemoryBySlug = {};
    for (const [slug, files] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(files)) continue;
      const normalized: DefaultAgentMemoryFile[] = [];
      for (const item of files) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const name = String(row.name ?? "").trim();
        const content = String(row.content ?? "").trim();
        if (!name || !content) continue;
        normalized.push({
          id: String(row.id ?? randomUUID()),
          name,
          description: String(row.description ?? "").trim(),
          content,
          memoryType: String(row.memoryType ?? "file").trim() || "file",
        });
      }
      result[slug] = normalized;
    }
    return result;
  } catch {
    return null;
  }
}

export async function loadDefaultAgentMemoryTemplates(): Promise<DefaultAgentMemoryBySlug> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEFAULT_AGENT_MEMORY_SETTINGS_KEY))
    .limit(1);

  if (!row?.value?.trim()) return {};
  return parseMemoryJson(row.value) ?? {};
}

async function persistDefaultAgentMemoryTemplates(templates: DefaultAgentMemoryBySlug): Promise<void> {
  const payload = JSON.stringify(templates);
  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEFAULT_AGENT_MEMORY_SETTINGS_KEY))
    .limit(1);

  if (existing) {
    await db
      .update(settingsTable)
      .set({
        value: payload,
        category: DEFAULT_AGENT_MEMORY_CATEGORY,
        updatedAt: new Date(),
      })
      .where(eq(settingsTable.key, DEFAULT_AGENT_MEMORY_SETTINGS_KEY));
    return;
  }

  await db.insert(settingsTable).values({
    key: DEFAULT_AGENT_MEMORY_SETTINGS_KEY,
    value: payload,
    category: DEFAULT_AGENT_MEMORY_CATEGORY,
    isSecret: false,
  });
}

export async function listDefaultAgentMemoryFiles(slug: string): Promise<DefaultAgentMemoryFile[]> {
  const templates = await loadDefaultAgentMemoryTemplates();
  return templates[slug] ?? [];
}

export async function addDefaultAgentMemoryText(input: {
  slug: string;
  name: string;
  description?: string;
  content: string;
  memoryType?: string;
}): Promise<DefaultAgentMemoryFile> {
  const name = input.name.trim();
  const content = input.content.trim();
  if (!name) throw new Error("Memory name is required.");
  if (!content) throw new Error("Memory content is required.");

  const templates = await loadDefaultAgentMemoryTemplates();
  const files = templates[input.slug] ?? [];
  const file: DefaultAgentMemoryFile = {
    id: randomUUID(),
    name,
    description: input.description?.trim() ?? "",
    content,
    memoryType: input.memoryType?.trim() || "file",
  };
  templates[input.slug] = [...files, file];
  await persistDefaultAgentMemoryTemplates(templates);
  await syncAllWorkspaceDefaultAgentMemory(templates);
  return file;
}

export async function addDefaultAgentMemoryFromFile(input: {
  slug: string;
  name: string;
  description?: string;
  filename: string;
  buffer: Buffer;
}): Promise<DefaultAgentMemoryFile> {
  const content = await extractMemoryFileText({
    filename: input.filename,
    buffer: input.buffer,
  });
  return addDefaultAgentMemoryText({
    slug: input.slug,
    name: input.name,
    description: input.description,
    content,
    memoryType: "file",
  });
}

export async function deleteDefaultAgentMemoryFile(slug: string, memoryId: string): Promise<void> {
  const templates = await loadDefaultAgentMemoryTemplates();
  const files = templates[slug] ?? [];
  const next = files.filter((file) => file.id !== memoryId);
  if (next.length === files.length) {
    throw new Error("Memory file not found.");
  }
  templates[slug] = next;
  await persistDefaultAgentMemoryTemplates(templates);
  await syncAllWorkspaceDefaultAgentMemory(templates);
}

async function replaceWorkspaceDefaultAgentMemory(
  workspaceId: number,
  agentId: number,
  files: DefaultAgentMemoryFile[],
): Promise<void> {
  await db
    .update(sellermateMemoryTable)
    .set({ isDeleted: 1, deletedAt: new Date() })
    .where(and(
      eq(sellermateMemoryTable.workspaceId, workspaceId),
      eq(sellermateMemoryTable.agentId, agentId),
      eq(sellermateMemoryTable.isDeleted, 0),
      eq(sellermateMemoryTable.userId, ADMIN_TEMPLATE_MEMORY_USER_ID),
    ));

  if (files.length === 0) return;

  await db.insert(sellermateMemoryTable).values(
    files.map((file) => ({
      agentId,
      workspaceId,
      userId: ADMIN_TEMPLATE_MEMORY_USER_ID,
      name: file.name,
      description: file.description,
      content: file.content,
      memoryKey: `${ADMIN_TEMPLATE_MEMORY_KEY_PREFIX}${file.id}`,
      memoryType: file.memoryType,
    })),
  );
}

export async function syncWorkspaceDefaultAgentMemory(
  workspaceId: number,
  templates?: DefaultAgentMemoryBySlug,
): Promise<void> {
  const memoryTemplates = templates ?? await loadDefaultAgentMemoryTemplates();
  const slugs = Object.keys(memoryTemplates);
  if (slugs.length === 0) return;

  for (const slug of slugs) {
    const [agent] = await db
      .select()
      .from(sellermateAgentsTable)
      .where(and(
        eq(sellermateAgentsTable.workspaceId, workspaceId),
        eq(sellermateAgentsTable.slug, slug),
        eq(sellermateAgentsTable.isDefault, 1),
        eq(sellermateAgentsTable.isDeleted, 0),
      ))
      .limit(1);

    if (!agent) continue;
    await replaceWorkspaceDefaultAgentMemory(workspaceId, agent.id, memoryTemplates[slug] ?? []);
  }
}

export async function syncAllWorkspaceDefaultAgentMemory(
  templates?: DefaultAgentMemoryBySlug,
): Promise<void> {
  const memoryTemplates = templates ?? await loadDefaultAgentMemoryTemplates();
  const workspaceRows = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable);

  for (const row of workspaceRows) {
    await syncWorkspaceDefaultAgentMemory(row.id, memoryTemplates);
  }
}
