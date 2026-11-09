import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SkillType } from "@/lib/admin-skill-editor";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type AiSkillRecord = {
  id: number;
  slug: string;
  name: string;
  status: "draft" | "published";
  skillType: SkillType;
  skillKind?: "custom" | "marketplace_content";
  category: string;
  marketplaceSlug: string;
  aiModel: string;
  instructionsText: string;
  contentMarketplaceId?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SkillTestOutput = {
  title: string;
  titleCount: number;
  titleMax: number;
  bullets: string[];
  description: string;
  bannedFound: string[];
  modelLabel: string;
  sampleCategory: string;
  tone: string;
  bannedCount: number;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useAdminAiSkills() {
  return useQuery({
    queryKey: ["admin", "ai-skills"],
    queryFn: () => fetchJson<{ skills: AiSkillRecord[] }>(`${basePath}/api/admin/ai-skills`),
  });
}

export function useAdminAiSkill(idOrSlug: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "ai-skills", idOrSlug],
    enabled: enabled && Boolean(idOrSlug),
    queryFn: () =>
      fetchJson<{ skill: AiSkillRecord }>(
        `${basePath}/api/admin/ai-skills/${encodeURIComponent(idOrSlug!)}`,
      ),
  });
}

export type SaveAiSkillPayload = {
  name: string;
  instructionsText: string;
  skillType: SkillType;
  category: string;
  marketplaceSlug: string;
  aiModel: string;
  status: "draft" | "published";
};

export async function createAdminAiSkill(payload: SaveAiSkillPayload) {
  return fetchJson<{ skill: AiSkillRecord }>(`${basePath}/api/admin/ai-skills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminAiSkill(idOrSlug: string, payload: SaveAiSkillPayload) {
  return fetchJson<{ skill: AiSkillRecord }>(
    `${basePath}/api/admin/ai-skills/${encodeURIComponent(idOrSlug)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function runAdminAiSkillTest(params: {
  idOrSlug?: string;
  instructionsText: string;
  sampleProductId: string;
  aiModel: string;
}): Promise<SkillTestOutput> {
  const url = params.idOrSlug
    ? `${basePath}/api/admin/ai-skills/${encodeURIComponent(params.idOrSlug)}/test`
    : `${basePath}/api/admin/ai-skills/test`;
  const data = await fetchJson<{ output: SkillTestOutput }>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instructionsText: params.instructionsText,
      sampleProductId: params.sampleProductId,
      aiModel: params.aiModel,
    }),
  });
  return data.output;
}

export function useAdminAiSkillSampleProducts() {
  return useQuery({
    queryKey: ["admin", "ai-skills", "samples", "products"],
    queryFn: () =>
      fetchJson<{ products: { id: string; label: string }[] }>(
        `${basePath}/api/admin/ai-skills/samples/products`,
      ),
    staleTime: 300_000,
  });
}

export function useInvalidateAdminAiSkills() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "ai-skills"] });
}
