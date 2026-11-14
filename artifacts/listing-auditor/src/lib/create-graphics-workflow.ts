import { workflowSearchParams } from "@/lib/audit-listing-workflow";

export const CREATE_GRAPHICS_WORKFLOW_FLOW = "create-graphics";

const SESSION_KEY = "ecommguru-create-graphics-workflow";

export function markCreateGraphicsWorkflowIntent(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearCreateGraphicsWorkflowIntent(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function hasCreateGraphicsWorkflowSessionIntent(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function isCreateGraphicsExistingProductWorkflow(search: string | undefined): boolean {
  const params = workflowSearchParams(search);
  if (params.get("flow") === CREATE_GRAPHICS_WORKFLOW_FLOW) return true;
  if (params.get("entry") === "existing" && hasCreateGraphicsWorkflowSessionIntent()) return true;
  return false;
}

export function createGraphicsExistingProductWorkflowSearch(): string {
  const params = new URLSearchParams({
    entry: "existing",
    flow: CREATE_GRAPHICS_WORKFLOW_FLOW,
  });
  return `?${params.toString()}`;
}

export function isCreateGraphicsWorkflowPath(location: string, search = ""): boolean {
  return location === "/audits/workflow" && isCreateGraphicsExistingProductWorkflow(search);
}
