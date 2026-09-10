import { ApiFetchError } from "@/lib/api-fetch";
import { WORKSPACES_HUB_LABEL } from "@/lib/workspaces-hub";

export const EXCEEDS_WORKSPACE_POOL_CODE = "EXCEEDS_WORKSPACE_POOL";

export function memberCreditAssignmentErrorToast(err: Error): { title: string; description: string } {
  const code =
    err instanceof ApiFetchError
      ? err.code
      : (err as Error & { code?: string }).code;

  if (code === EXCEEDS_WORKSPACE_POOL_CODE) {
    return {
      title: "Add workspace credits first",
      description:
        err.message ||
        `Fund this workspace from ${WORKSPACES_HUB_LABEL}, then assign credits to members.`,
    };
  }

  return { title: "Failed to update credits", description: err.message };
}
