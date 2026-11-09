import { useQuery } from "@tanstack/react-query";
import type { SkillType } from "@/lib/admin-skill-editor";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type SkillChatModelOption = {
  value: string;
  label: string;
  detail: string;
};

export type SkillChatModelsResponse = {
  options: SkillChatModelOption[];
  settingsDefaultDetail: string;
};

export function skillChatModelDisplay(
  options: SkillChatModelOption[],
  value: string,
  settingsDefaultDetail: string,
): string {
  const v = value?.trim() ?? "";
  if (!v) return `AI Settings (${settingsDefaultDetail})`;
  const hit = options.find((o) => o.value === v);
  return hit ? hit.label : value;
}

export function normalizeLegacySkillAiModel(
  stored: string | undefined,
  options: SkillChatModelOption[],
): string {
  const v = stored?.trim() ?? "";
  if (!v) return "";
  if (options.some((o) => o.value === v)) return v;
  const legacyLabels = new Set([
    "Claude Sonnet 5.5",
    "GPT-5.4",
    "Gemini 2.5 Flash",
    "OpenAI GPT-4o",
  ]);
  if (legacyLabels.has(v)) return "";
  return v;
}

export function useAdminSkillChatModels(skillType: SkillType) {
  return useQuery({
    queryKey: ["admin", "ai-skills", "chat-models", skillType],
    queryFn: () =>
      fetch(`${basePath}/api/admin/ai-skills/chat-models?skillType=${encodeURIComponent(skillType)}`, {
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Could not load AI models from settings");
        return r.json() as Promise<SkillChatModelsResponse>;
      }),
    staleTime: 60_000,
  });
}
