import { and, eq } from "drizzle-orm";
import {
  db,
  sellermateAgentToolsTable,
} from "@workspace/db";
import {
  isValidAgentToolName,
  type AgentToolName,
} from "./agent-registry.js";

export async function ensureWorkspaceDefaultAgents(workspaceId: number): Promise<void> {
  const { syncWorkspaceDefaultAgents } = await import("./default-agent-templates.js");
  await syncWorkspaceDefaultAgents(workspaceId);
}

export async function seedAgentTools(
  agentId: number,
  workspaceId: number,
  tools: AgentToolName[],
): Promise<void> {
  for (const toolName of tools) {
    const [existing] = await db
      .select({ id: sellermateAgentToolsTable.id })
      .from(sellermateAgentToolsTable)
      .where(and(
        eq(sellermateAgentToolsTable.agentId, agentId),
        eq(sellermateAgentToolsTable.toolName, toolName),
      ))
      .limit(1);

    if (existing) continue;

    await db.insert(sellermateAgentToolsTable).values({
      agentId,
      workspaceId,
      toolName,
      enabled: 1,
      requiresApproval: 0,
    });
  }
}

export async function replaceAgentTools(input: {
  agentId: number;
  workspaceId: number;
  tools: Array<{ toolName: AgentToolName; enabled?: boolean; requiresApproval?: boolean }>;
}): Promise<void> {
  await db
    .delete(sellermateAgentToolsTable)
    .where(and(
      eq(sellermateAgentToolsTable.agentId, input.agentId),
      eq(sellermateAgentToolsTable.workspaceId, input.workspaceId),
    ));

  if (input.tools.length === 0) return;

  await db.insert(sellermateAgentToolsTable).values(
    input.tools.map((tool) => ({
      agentId: input.agentId,
      workspaceId: input.workspaceId,
      toolName: tool.toolName,
      enabled: tool.enabled === false ? 0 : 1,
      requiresApproval: tool.requiresApproval ? 1 : 0,
    })),
  );
}

export async function listAgentTools(agentId: number, workspaceId: number) {
  return db
    .select()
    .from(sellermateAgentToolsTable)
    .where(and(
      eq(sellermateAgentToolsTable.agentId, agentId),
      eq(sellermateAgentToolsTable.workspaceId, workspaceId),
    ));
}

export async function getEnabledAgentToolNames(
  agentId: number,
  workspaceId: number,
): Promise<AgentToolName[]> {
  const tools = await listAgentTools(agentId, workspaceId);
  return tools
    .filter((tool) => tool.enabled === 1 && isValidAgentToolName(tool.toolName))
    .map((tool) => tool.toolName as AgentToolName);
}

export async function isAgentToolEnabled(
  agentId: number,
  workspaceId: number,
  toolName: AgentToolName,
): Promise<boolean> {
  const enabled = await getEnabledAgentToolNames(agentId, workspaceId);
  return enabled.includes(toolName);
}
