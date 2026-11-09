import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SkillType } from "@/lib/admin-skill-editor";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export type AiSkillRecord = {
  id: number;
  slug: string;
  name: string;
  status: "draft" | "published";
  skillType: SkillType;
  skillKind?: "custom" | "marketplace_content" | "image_prompt";
  imagePromptTemplateId?: number | null;
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

export async function deleteAdminAiSkill(idOrSlug: string) {
  return fetchJson<{ ok: boolean; deleted?: string }>(
    `${basePath}/api/admin/ai-skills/${encodeURIComponent(idOrSlug)}`,
    { method: "DELETE" },
  );
}

export type AuditSkillTestResult = {
  titleScore: { score: number; issues: string[]; suggestions: string[] };
  bulletScore: { score: number; issues: string[]; suggestions: string[] };
  imageScore: { score: number; issues: string[]; suggestions: string[] };
  keywordScore: { score: number; issues: string[]; suggestions: string[] };
  overallScore: number;
  summary: string;
  display?: {
    showTitle: boolean;
    showBullets: boolean;
    showImages: boolean;
    showKeywords: boolean;
  };
};

export type ListingAuditSkillTestPayload = {
  mode: "listing_audit";
  result: AuditSkillTestResult;
  listing: {
    title: string;
    category: string;
    bulletPoints: string[];
    imageUrls: string[];
    targetKeywords: string[];
  };
  skillConfig: {
    weights: { title: number; bullet: number; image: number; keyword: number };
    show: { title: boolean; bullet: boolean; image: boolean; keyword: boolean };
    scoreOffset: number;
    scoreFloor: number;
    scoreCeiling: number;
  };
};

export type AdminSkillTestResponse =
  | { mode: "product_content"; output: SkillTestOutput }
  | ListingAuditSkillTestPayload;

export async function runAdminAiSkillTest(params: {
  idOrSlug?: string;
  instructionsText: string;
  sampleProductId: string;
  aiModel: string;
  skillType: string;
  category?: string;
}): Promise<AdminSkillTestResponse> {
  const url = params.idOrSlug
    ? `${basePath}/api/admin/ai-skills/${encodeURIComponent(params.idOrSlug)}/test`
    : `${basePath}/api/admin/ai-skills/test`;
  return fetchJson<AdminSkillTestResponse>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instructionsText: params.instructionsText,
      sampleProductId: params.sampleProductId,
      aiModel: params.aiModel,
      skillType: params.skillType,
      category: params.category ?? "",
    }),
  });
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
