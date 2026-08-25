import type { AgentToolConfig, AgentToolDefinition } from "@/lib/sellermate-ai";

/** New custom agents start with every catalog tool enabled. */
export function defaultAgentToolSelection(catalog: AgentToolDefinition[]): AgentToolConfig[] {
  return catalog.map((tool) => ({
    toolName: tool.name,
    enabled: true,
    requiresApproval: tool.defaultRequiresApproval,
  }));
}

/** Merge saved agent tools with the full catalog so every checkbox maps to a row on save. */
export function mergeAgentToolSelection(
  catalog: AgentToolDefinition[],
  saved?: AgentToolConfig[],
): AgentToolConfig[] {
  return catalog.map((tool) => {
    const match = saved?.find((row) => row.toolName === tool.name);
    return {
      toolName: tool.name,
      enabled: match?.enabled ?? false,
      requiresApproval: match?.requiresApproval ?? tool.defaultRequiresApproval,
    };
  });
}
