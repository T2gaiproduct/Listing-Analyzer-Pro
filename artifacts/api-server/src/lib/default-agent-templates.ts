import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db, sellermateAgentsTable, settingsTable, workspacesTable } from "@workspace/db";
import {
  DEFAULT_AGENT_ICON_OPTIONS,
  LEGACY_DEFAULT_AGENT_SLUGS,
  SUPPORTED_AGENT_MODELS,
  WORKSPACE_DEFAULT_AGENTS,
  isValidAgentSlugFormat,
  isValidAgentToolName,
  slugifyDefaultAgentName,
  type AgentToolName,
  type DefaultAgentDefinition,
} from "./agent-registry.js";
import { isMakeExecutionEnabled } from "./make-agent-client.js";
import { replaceAgentTools } from "./workspace-agents.js";

export const DEFAULT_AGENT_TEMPLATES_SETTINGS_KEY = "sellermate_default_agent_templates";
export const DEFAULT_AGENT_TEMPLATES_CATEGORY = "ai";

export type DefaultAgentTemplate = DefaultAgentDefinition;

const DEFAULT_NEW_AGENT_PROMPT = `You are a SellerLens AI assistant for Amazon sellers.
Help users with clear, actionable guidance. Ask clarifying questions when context is missing.`;

function builtinForSlug(slug: string): DefaultAgentTemplate | undefined {
  return WORKSPACE_DEFAULT_AGENTS.find((row) => row.slug === slug);
}

function normalizeIcon(icon: string | undefined, slug: string): string {
  const value = icon?.trim() || builtinForSlug(slug)?.icon || "sparkles";
  return (DEFAULT_AGENT_ICON_OPTIONS as readonly string[]).includes(value) ? value : "sparkles";
}

function normalizeModel(model: string | undefined, slug: string): string {
  const value = model?.trim() || builtinForSlug(slug)?.model || "gpt-5.4";
  return (SUPPORTED_AGENT_MODELS as readonly string[]).includes(value) ? value : "gpt-5.4";
}

function normalizeTools(tools: unknown, slug: string): AgentToolName[] {
  const fromInput = Array.isArray(tools)
    ? tools.filter((t): t is AgentToolName => typeof t === "string" && isValidAgentToolName(t))
    : [];
  if (fromInput.length > 0) return fromInput;
  return builtinForSlug(slug)?.tools ?? ["get_seller_memory", "save_agent_memory"];
}

function normalizeTemplateRow(
  row: Record<string, unknown>,
  existingSlugs: string[],
): DefaultAgentTemplate | null {
  const name = String(row.name ?? "").trim();
  if (!name) return null;

  let slug = String(row.slug ?? "").trim().toLowerCase();
  if (!slug || !isValidAgentSlugFormat(slug)) {
    slug = slugifyDefaultAgentName(name, existingSlugs);
  }
  if (!isValidAgentSlugFormat(slug)) return null;

  const builtin = builtinForSlug(slug);
  const systemPrompt = String(row.systemPrompt ?? builtin?.systemPrompt ?? DEFAULT_NEW_AGENT_PROMPT).trim();
  if (!systemPrompt) return null;

  return {
    slug,
    name,
    description: String(row.description ?? builtin?.description ?? "").trim(),
    icon: normalizeIcon(typeof row.icon === "string" ? row.icon : undefined, slug),
    model: normalizeModel(typeof row.model === "string" ? row.model : undefined, slug),
    systemPrompt,
    tools: normalizeTools(row.tools, slug),
  };
}

function parseTemplatesJson(raw: string): DefaultAgentTemplate[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const templates: DefaultAgentTemplate[] = [];
    const slugs: string[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const normalized = normalizeTemplateRow(item as Record<string, unknown>, slugs);
      if (!normalized) continue;
      if (slugs.includes(normalized.slug)) continue;
      slugs.push(normalized.slug);
      templates.push(normalized);
    }
    return templates.length > 0 ? templates : null;
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
  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error("At least one default agent is required.");
  }

  const normalized: DefaultAgentTemplate[] = [];
  const slugs: string[] = [];

  for (const template of templates) {
    const row = normalizeTemplateRow(template as unknown as Record<string, unknown>, slugs);
    if (!row) {
      throw new Error("Each default agent needs a name and system prompt.");
    }
    if (slugs.includes(row.slug)) {
      throw new Error(`Duplicate default agent slug: ${row.slug}`);
    }
    slugs.push(row.slug);
    normalized.push(row);
  }

  return normalized;
}

export function createBlankDefaultAgentTemplate(existing: DefaultAgentTemplate[]): DefaultAgentTemplate {
  const name = "New Default Agent";
  const slug = slugifyDefaultAgentName(name, existing.map((row) => row.slug));
  return {
    slug,
    name,
    description: "",
    icon: "sparkles",
    model: "gpt-5.4",
    systemPrompt: DEFAULT_NEW_AGENT_PROMPT,
    tools: ["get_seller_memory", "save_agent_memory"],
  };
}

async function retireLegacyDefaultAgents(workspaceId: number): Promise<void> {
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

async function retireRemovedDefaultAgents(workspaceId: number, activeSlugs: string[]): Promise<void> {
  if (activeSlugs.length === 0) return;
  await db
    .update(sellermateAgentsTable)
    .set({ isDeleted: 1, deletedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(sellermateAgentsTable.workspaceId, workspaceId),
      eq(sellermateAgentsTable.isDefault, 1),
      eq(sellermateAgentsTable.isDeleted, 0),
      notInArray(sellermateAgentsTable.slug, activeSlugs),
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
  const activeSlugs = definitions.map((row) => row.slug);

  await retireLegacyDefaultAgents(workspaceId);
  await retireRemovedDefaultAgents(workspaceId, activeSlugs);

  for (const definition of definitions) {
    await upsertWorkspaceDefaultAgent(workspaceId, definition, executionProvider);
  }

  const { syncWorkspaceDefaultAgentMemory } = await import("./default-agent-memory-templates.js");
  await syncWorkspaceDefaultAgentMemory(workspaceId);
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
