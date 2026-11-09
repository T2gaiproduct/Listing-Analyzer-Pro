import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { AiSkillRecord } from "@/lib/admin-ai-skills-api";
import {
  skillCatalogCategory,
  skillCatalogFilename,
  skillCatalogMarketplace,
  skillCatalogType,
  skillCatalogVersion,
} from "@/lib/admin-skills-catalog";
import { useAdminSkillTypes, type SkillCatalogTypeLabel } from "@/lib/admin-skill-types";

function TypeBadge({ type }: { type: SkillCatalogTypeLabel }) {
  if (type === "Image") {
    return (
      <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
        Image
      </span>
    );
  }
  if (type === "Audit") {
    return (
      <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-900">
        Audit
      </span>
    );
  }
  if (type === "Product content") {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
        Product content
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-900">
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: AiSkillRecord["status"] }) {
  const live = status === "published";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
        live
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-amber-50 text-amber-900 border-amber-200",
      )}
    >
      {live ? "Live" : "Draft"}
    </span>
  );
}

function formatUpdated(skill: AiSkillRecord): string {
  const raw = skill.updatedAt ?? skill.createdAt;
  if (!raw) return "—";
  try {
    return formatDistanceToNow(new Date(raw), { addSuffix: true });
  } catch {
    return "—";
  }
}

type Props = {
  skills: AiSkillRecord[];
  isLoading?: boolean;
  selectedSlug?: string | null;
};

export function AdminSkillsCatalogTable({ skills, isLoading, selectedSlug }: Props) {
  const [, navigate] = useLocation();
  const { data: skillTypes = [] } = useAdminSkillTypes();

  const sorted = useMemo(
    () => [...skills].sort((a, b) => a.name.localeCompare(b.name)),
    [skills],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3 pl-5 pr-4">Skill</th>
              <th className="py-3 pr-4">Type</th>
              <th className="py-3 pr-4">Category</th>
              <th className="py-3 pr-4">Marketplace</th>
              <th className="py-3 pr-4">AI model</th>
              <th className="py-3 pr-4">Version</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-5 text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  Loading skills…
                </td>
              </tr>
            )}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  No skills yet. Create a marketplace, audit, image prompt, or category skill.
                </td>
              </tr>
            )}
            {!isLoading &&
              sorted.map((skill) => {
                const active = selectedSlug === skill.slug;
                const type = skillCatalogType(skill, skillTypes);
                const category = skillCatalogCategory(skill);
                const marketplace = skillCatalogMarketplace(skill);
                const model = skill.aiModel?.trim() || "—";

                return (
                  <tr
                    key={skill.id}
                    className={cn(
                      "border-b border-slate-100 transition-colors cursor-pointer",
                      active
                        ? "bg-emerald-50/80"
                        : "hover:bg-emerald-50/50",
                    )}
                    onClick={() => navigate(`/admin/settings/ai/skills/${skill.slug}`)}
                  >
                    <td className="py-3.5 pl-5 pr-4">
                      <p className="font-semibold text-slate-900 leading-snug">{skill.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{skillCatalogFilename(skill)}</p>
                    </td>
                    <td className="py-3.5 pr-4">
                      <TypeBadge type={type} />
                    </td>
                    <td className="py-3.5 pr-4 text-slate-700">{category}</td>
                    <td className="py-3.5 pr-4 text-slate-600">{marketplace}</td>
                    <td className="py-3.5 pr-4 text-slate-700 whitespace-nowrap">{model}</td>
                    <td className="py-3.5 pr-4 text-slate-500 tabular-nums font-mono text-xs">
                      {skillCatalogVersion(skill)}
                    </td>
                    <td className="py-3.5 pr-4">
                      <StatusBadge status={skill.status} />
                    </td>
                    <td className="py-3.5 pr-5 text-right text-slate-500 text-xs whitespace-nowrap">
                      {formatUpdated(skill)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-slate-100 bg-slate-50/40">
        Data from{" "}
        <code className="text-slate-600">GET /api/admin/ai-skills</code>. Click a row to edit; publish in the skill
        editor to set status to Live.
      </p>
    </div>
  );
}
