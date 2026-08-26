export const ADMIN_TEMPLATE_MEMORY_USER_ID = "system:default-agent-template";
export const ADMIN_TEMPLATE_MEMORY_KEY_PREFIX = "admin:template:";

export function isSharedDefaultAgentMemory(memory: {
  userId?: string | null;
  memoryKey?: string | null;
}): boolean {
  return memory.userId === ADMIN_TEMPLATE_MEMORY_USER_ID
    || (memory.memoryKey?.startsWith(ADMIN_TEMPLATE_MEMORY_KEY_PREFIX) ?? false);
}
