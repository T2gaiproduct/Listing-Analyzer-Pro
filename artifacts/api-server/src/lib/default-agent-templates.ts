import { and, eq, inArray } from "drizzle-orm";
import { db, sellermateAgentsTable, settingsTable, workspacesTable } from "@workspace/db";
import {
  LEGACY_DEFAULT_AGENT_SLUGS,
  WORKSPACE_DEFAULT_AGENTS,
  isValidAgentToolName,
  isValidDefaultAgentSlug,
  type AgentToolName,
  type DefaultAgentDefinition,
  type DefaultAgentSlug,
} from "./agent-registry.js";
import { isMakeExecutionEnabled } from "./make-agent-client.js";
import { replaceAgentTools } from "./workspace-agents.js";

export const DEFAULT_AGENT_TEMPLATES_SETTINGS_KEY = "sellermate_default_agent_templates";
export const DEFAULT_AGENT_TEMPLATES_CATEGORY = "ai";

export type DefaultAgentTemplate = DefaultAgentDefinition;

function parseTemplatesJson(raw: string): DefaultAgentTemplate[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const templates: DefaultAgentTemplate[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const slug = String(row.slug ?? "");
      if (!isValidDefaultAgentSlug(slug)) continue;
      const tools = Array.isArray(row.tools)
        ? row.tools.filter((t): t is AgentToolName => typeof t === "string" && isValidAgentToolName(t))
        : WORKSPACE_DEFAULT_AGENTS.find((d) => d.slug === slug)?.tools ?? [];
      const builtin = WORKSPACE_DEFAULT_AGENTS.find((d) => d.slug === slug);
      templates.push({
        slug,
        name: String(row.name ?? builtin?.name ?? slug).trim(),
        description: String(row.description ?? builtin?.description ?? "").trim(),
        icon: String(row.icon ?? builtin?.icon ?? "sparkles").trim(),
        model: String(row.model ?? builtin?.model ?? "gpt-5.4").trim(),
        systemPrompt: String(row.systemPrompt ?? builtin?.systemPrompt ?? "").trim(),
        tools: tools.length > 0 ? tools : (builtin?.tools ?? []),
      });
    }
    if (templates.length === 0) return null;
    const bySlug = new Map(templates.map((t) => [t.slug, t]));
    return WORKSPACE_DEFAULT_AGENTS.map((builtin) => bySlug.get(builtin.slug) ?? builtin);
  } catch {
    return null;
  }
}

export function getBuiltinDefaultAgentTemplates(): DefaultAgentTemplate[] {
  return WORKSPACE_DEFAULT_AGENTS.map((row) => ({ ...row }));
}

export async function loadDefaultAgentTemplates(): Promise<DefaultAgentTemplate[]> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEFAULT_AGENT_TEMPLATES_SETTINGS_KEY))
    .limit(1);

  if (!row?.value?.trim()) {
    return getBuiltinDefaultAgentTemplates();
  }

  return parseTemplatesJson(row.value) ?? getBuiltinDefaultAgentTemplates();
}

export async function saveDefaultAgentTemplates(
  templates: DefaultAgentTemplate[],
): Promise<DefaultAgentTemplate[]> {
  const normalized = normalizeTemplates(templates);
  const payload = JSON.stringify(normalized);

  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, DEFAULT_AGENT_TEMPLATES_SETTINGS_KEY))
    .limit(1);

  if (existing) {
    await db
      .update(settingsTable)
      .set({
        value: payload,
        category: DEFAULT_AGENT_TEMPLATES_CATEGORY,
        updatedAt: new Date(),
      })
      .where(eq(settingsTable.key, DEFAULT_AGENT_TEMPLATES_SETTINGS_KEY));
  } else {
    await db.insert(settingsTable).values({
      key: DEFAULT_AGENT_TEMPLATES_SETTINGS_KEY,
      value: payload,
      category: DEFAULT_AGENT_TEMPLATES_CATEGORY,
      isSecret: false,
    });
  }

  await syncAllWorkspaceDefaultAgents(normalized);
  return normalized;
}

export function normalizeTemplates(templates: DefaultAgentTemplate[]): DefaultAgentTemplate[] {
  const bySlug = new Map<DefaultAgentSlug, DefaultAgentTemplate>();
  for (const template of templates) {
    if (!isValidDefaultAgentSlug(template.slug)) continue;
    const builtin = WORKSPACE_DEFAULT_AGENTS.find((row) => row.slug === template.slug);
    const name = template.name?.trim() || builtin?.name || template.slug;
    const systemPrompt = template.systemPrompt?.trim() || builtin?.systemPrompt || "";
    if (!systemPrompt) {
      throw new Error(`System prompt is required for ${name}.`);
    }
    const tools = (template.tools ?? [])
      .filter((tool): tool is AgentToolName => isValidAgentToolName(tool));
    bySlug.set(template.slug, {
      slug: template.slug,
      name,
      description: template.description?.trim() || builtin?.description || "",
      icon: template.icon?.trim() || builtin?.icon || "sparkles",
      model: template.model?.trim() || builtin?.model || "gpt-5.4",
      systemPrompt,
      tools: tools.length > 0 ? tools : (builtin?.tools ?? []),
    });
  }

  return WORKSPACE_DEFAULT_AGENTS.map((builtin) => bySlug.get(builtin.slug) ?? { ...builtin });
}

async function retireLegacyDefaultAgents(workspaceId: number): Promise<void> {
  if (LEGACY_DEFAULT_AGENT_SLUGS.length === 0) return;
  await db
    .update(sellermateAgentsTable)
    .set({ isDeleted: 1, deletedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(sellermateAgentsTable.workspaceId, workspaceId),
      eq(sellermateAgentsTable.isDefault, 1),
      inArray(sellermateAgentsTable.slug, [...LEGACY_DEFAULT_AGENT_SLUGS]),
      eq(sellermateAgentsTable.isDeleted, 0),
    ));
}

async function upsertWorkspaceDefaultAgent(
  workspaceId: number,
  definition: DefaultAgentTemplate,
  executionProvider: string,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(sellermateAgentsTable)
    .where(and(
      eq(sellermateAgentsTable.workspaceId, workspaceId),
      eq(sellermateAgentsTable.slug, definition.slug),
      eq(sellermateAgentsTable.isDefault, 1),
      eq(sellermateAgentsTable.isDeleted, 0),
    ))
    .limit(1);

  if (existing) {
    await db
      .update(sellermateAgentsTable)
      .set({
        name: definition.name,
        description: definition.description,
        systemPrompt: definition.systemPrompt,
        icon: definition.icon,
        model: definition.model,
        updatedAt: new Date(),
      })
      .where(eq(sellermateAgentsTable.id, existing.id));

    await replaceAgentTools({
      agentId: existing.id,
      workspaceId,
      tools: definition.tools.map((toolName) => ({
        toolName,
        enabled: true,
        requiresApproval: false,
      })),
    });
    return;
  }

  const [agent] = await db
    .insert(sellermateAgentsTable)
    .values({
      workspaceId,
      userId: null,
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      systemPrompt: definition.systemPrompt,
      icon: definition.icon,
      model: definition.model,
      status: "active",
      executionProvider,
      isDefault: 1,
    })
    .returning();

  if (!agent) return;

  await replaceAgentTools({
    agentId: agent.id,
    workspaceId,
    tools: definition.tools.map((toolName) => ({
      toolName,
      enabled: true,
      requiresApproval: false,
    })),
  });
}

export async function syncWorkspaceDefaultAgents(
  workspaceId: number,
  templates?: DefaultAgentTemplate[],
): Promise<void> {
  const definitions = templates ?? await loadDefaultAgentTemplates();
  const executionProvider = isMakeExecutionEnabled() ? "make" : "native";

  await retireLegacyDefaultAgents(workspaceId);

  for (const definition of definitions) {
    await upsertWorkspaceDefaultAgent(workspaceId, definition, executionProvider);
  }
}

export async function syncAllWorkspaceDefaultAgents(
  templates?: DefaultAgentTemplate[],
): Promise<void> {
  const definitions = templates ?? await loadDefaultAgentTemplates();
  const workspaceRows = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable);

  for (const row of workspaceRows) {
    await syncWorkspaceDefaultAgents(row.id, definitions);
  }
}
