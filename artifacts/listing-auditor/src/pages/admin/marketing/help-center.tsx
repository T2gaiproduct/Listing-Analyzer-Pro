import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Save, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { mergeHelpCms, type HelpCmsMap } from "@/lib/help-cms";
import { HelpCmsEditor } from "./help-cms-editor";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchHelpCms(): Promise<HelpCmsMap> {
  return fetch(`${basePath}/api/admin/cms/help`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminMarketingHelpCenter() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [localData, setLocalData] = useState<HelpCmsMap>(() => mergeHelpCms(null));
  const [dirty, setDirty] = useState(false);

  const { isLoading, data: cmsData } = useQuery({
    queryKey: ["admin-cms-help"],
    queryFn: fetchHelpCms,
  });

  useEffect(() => {
    if (cmsData && !dirty) {
      setLocalData(mergeHelpCms(cmsData));
    }
  }, [cmsData, dirty]);

  const saveMutation = useMutation({
    mutationFn: (data: HelpCmsMap) =>
      fetch(`${basePath}/api/admin/cms/help`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Save failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-help"] });
      qc.invalidateQueries({ queryKey: ["help-cms"] });
      setDirty(false);
      toast({ title: "Help Center saved", description: "Changes are live on /help." });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  function handleChange(key: string, val: string) {
    setLocalData((p) => ({ ...p, [key]: val }));
    setDirty(true);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-orange-500" /> Help Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Hero, category cards, and copy on <code className="text-xs">/help</code>. FAQs are managed under FAQ.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/help", "_blank")}>
            <Eye className="w-4 h-4 mr-1.5" /> Preview
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            size="sm"
            disabled={!dirty || saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate(localData)}
          >
            {saveMutation.isPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5 text-sm text-orange-700">
          You have unsaved changes
        </div>
      )}

      {isLoading ? (
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
      ) : (
        <HelpCmsEditor data={localData} onChange={handleChange} />
      )}
    </div>
  );
}
