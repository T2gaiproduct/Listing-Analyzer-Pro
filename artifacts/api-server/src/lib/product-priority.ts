export interface ProductPriorityInput {
  overallScore?: number | null;
  status?: string | null;
  currentStep?: number | null;
  aiSuggestionCount?: number;
}

/** Derive product priority from listing health, workflow stage, and open suggestions. */
export function mapProductPriority(input: ProductPriorityInput): {
  label: string;
  level: "low" | "medium" | "high";
} {
  const score = input.overallScore ?? 0;
  const step = input.currentStep ?? 1;
  const status = input.status ?? "draft";
  const suggestionCount = input.aiSuggestionCount ?? 0;

  if (status === "failed") {
    return { label: "High Priority", level: "high" };
  }

  if (step >= 5 && status !== "complete") {
    return { label: "High Priority", level: "high" };
  }

  if (suggestionCount >= 4 || (score > 0 && score < 50)) {
    return { label: "High Priority", level: "high" };
  }

  if (status === "complete" || score >= 80) {
    return { label: "Low Priority", level: "low" };
  }

  if (step > 1 || status === "pending" || score >= 50 || suggestionCount >= 2) {
    return { label: "Medium Priority", level: "medium" };
  }

  return { label: "Low Priority", level: "low" };
}

export function priorityFromStoredLevel(level: string | null | undefined): {
  label: string;
  level: "low" | "medium" | "high";
} | null {
  if (level === "high") return { label: "High Priority", level: "high" };
  if (level === "medium") return { label: "Medium Priority", level: "medium" };
  if (level === "low") return { label: "Low Priority", level: "low" };
  return null;
}
