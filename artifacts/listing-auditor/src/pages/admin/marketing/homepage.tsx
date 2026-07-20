import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, RefreshCw, Home, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { mergeHomepageCms, type HomepageCmsMap } from "@/lib/homepage-cms";
import { HOMEPAGE_CMS_SECTIONS, HOMEPAGE_CMS_TAB_LABELS, type CmsField } from "./homepage-cms-sections";
import { HeroSlidesEditor } from "./hero-slides-editor";
import { PortfolioCmsEditor } from "./portfolio-cms-editor";
import { DEFAULT_HERO_SLIDES, HERO_AUTOPLAY_ENABLED_KEY, HERO_AUTOPLAY_INTERVAL_KEY, HERO_SLIDES_JSON_KEY, serializeHeroSlides } from "@/lib/hero-slides";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchCms(pageSlug: string): Promise<HomepageCmsMap> {
  return fetch(`${basePath}/api/admin/cms/${pageSlug}`, { credentials: "include" }).then((r) => r.json());
}

function SectionEditor({ title, fields, data, onChange }: {
  title: string;
  fields: CmsField[];
  data: HomepageCmsMap;
  onChange: (key: string, val: string) => void;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <Label className="text-xs text-slate-500">{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea
                className="mt-1 text-sm resize-none"
                rows={f.rows ?? 3}
                value={data[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            ) : f.type === "select" && f.options ? (
              <select
                className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={data[f.key] ?? f.options[0]?.value ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <Input className="mt-1 h-8 text-sm" value={data[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminMarketingHomepage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [localData, setLocalData] = useState<HomepageCmsMap>(() =>
    mergeHomepageCms({
      [HERO_SLIDES_JSON_KEY]: serializeHeroSlides(DEFAULT_HERO_SLIDES),
      [HERO_AUTOPLAY_ENABLED_KEY]: "true",
      [HERO_AUTOPLAY_INTERVAL_KEY]: "6",
    }),
  );
  const [dirty, setDirty] = useState(false);

  const { isLoading, data: cmsData } = useQuery({
    queryKey: ["admin-cms-homepage"],
    queryFn: () => fetchCms("homepage"),
  });

  useEffect(() => {
    if (cmsData && !dirty) {
      setLocalData(mergeHomepageCms(cmsData));
    }
  }, [cmsData, dirty]);

  const saveMutation = useMutation({
    mutationFn: (data: HomepageCmsMap) =>
      fetch(`${basePath}/api/admin/cms/homepage`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-homepage"] });
      qc.invalidateQueries({ queryKey: ["homepage-cms"] });
      setDirty(false);
      toast({ title: "Homepage content saved", description: "Changes are now live on the website." });
    },
  });

  function handleChange(key: string, val: string) {
    setLocalData((p) => ({ ...p, [key]: val }));
    setDirty(true);
  }

  const tabKeys = Object.keys(HOMEPAGE_CMS_SECTIONS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Home className="w-6 h-6 text-orange-500" /> Homepage CMS
          </h1>
          <p className="text-slate-500 text-sm mt-1">Edit all homepage content — changes go live instantly</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/", "_blank")}>
            <Eye className="w-4 h-4 mr-1.5" /> Preview
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            size="sm"
            disabled={!dirty || saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate(localData)}
          >
            {saveMutation.isPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save Changes
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5 text-sm text-orange-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          You have unsaved changes
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <Tabs defaultValue="hero">
          <TabsList className="flex-wrap h-auto gap-1">
            {tabKeys.map((k) => (
              <TabsTrigger key={k} value={k}>{HOMEPAGE_CMS_TAB_LABELS[k] ?? k}</TabsTrigger>
            ))}
          </TabsList>
          {tabKeys.map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4 mt-4">
              {tab === "hero" && (
                <HeroSlidesEditor data={localData} onChange={handleChange} />
              )}
              {tab === "portfolio" && (
                <PortfolioCmsEditor data={localData} onChange={handleChange} />
              )}
              {HOMEPAGE_CMS_SECTIONS[tab].map((section) => (
                <SectionEditor
                  key={section.title}
                  title={section.title}
                  fields={section.fields}
                  data={localData}
                  onChange={handleChange}
                />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
