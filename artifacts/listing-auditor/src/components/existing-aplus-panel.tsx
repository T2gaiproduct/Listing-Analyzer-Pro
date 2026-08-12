import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { getGetAuditQueryKey, useGetAudit } from "@workspace/api-client-react";
import { AplusModuleGallery } from "@/components/aplus-module-gallery";
import { readAplusFromAudit } from "@/components/aplus-content-wizard";

export function ExistingAplusPanel({ auditId }: { auditId: number }) {
  const queryClient = useQueryClient();

  const { data: auditData } = useGetAudit(auditId, {
    query: { queryKey: getGetAuditQueryKey(auditId), enabled: auditId > 0 },
  });

  const aplusState = useMemo(
    () => readAplusFromAudit(auditData?.generatedImages),
    [auditData?.generatedImages],
  );

  const modules = aplusState.modules;
  const hasContent = modules.length > 0;

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center gap-1.5 px-1">
        <Sparkles className="w-3.5 h-3.5 text-slate-500" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Existing A+ Content
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <p className="text-[10px] font-semibold text-slate-700">Current modules</p>
        </div>
        <div className="px-4 py-4">
          {!hasContent ? (
            <p className="text-[11px] text-slate-500 text-center py-6">
              No A+ content yet. Generated modules will appear here.
            </p>
          ) : (
            <AplusModuleGallery
              auditId={auditId}
              modules={modules}
              onModulesUpdate={() => {
                void queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
