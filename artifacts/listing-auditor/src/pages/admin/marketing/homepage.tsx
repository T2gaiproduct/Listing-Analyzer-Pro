import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, RefreshCw, Home, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type CmsMap = Record<string, string>;

function fetchCms(pageSlug: string): Promise<CmsMap> {
  return fetch(`${basePath}/api/admin/cms/${pageSlug}`, { credentials: "include" }).then((r) => r.json());
}

function SectionEditor({ title, fields, data, onChange }: {
  title: string;
  fields: { key: string; label: string; type?: "text" | "textarea" | "url" }[];
  data: CmsMap;
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
              <Textarea className="mt-1 text-sm resize-none" rows={3} value={data[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)} />
            ) : (
              <Input className="mt-1 h-8 text-sm" value={data[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const SECTIONS: Record<string, { title: string; fields: { key: string; label: string; type?: "text" | "textarea" | "url" }[] }[]> = {
  hero: [
    {
      title: "Hero Section",
      fields: [
        { key: "hero.heading", label: "Main Heading" },
        { key: "hero.subheading", label: "Subheading", type: "textarea" },
        { key: "hero.cta_primary_text", label: "Primary CTA Text" },
        { key: "hero.cta_primary_url", label: "Primary CTA URL" },
        { key: "hero.cta_secondary_text", label: "Secondary CTA Text" },
        { key: "hero.cta_secondary_url", label: "Secondary CTA URL" },
        { key: "hero.badge_text", label: "Badge Text (optional)" },
        { key: "hero.video_url", label: "Demo Video URL (optional)", type: "url" },
      ],
    },
  ],
  features: [
    {
      title: "Features Section",
      fields: [
        { key: "features.heading", label: "Section Heading" },
        { key: "features.subheading", label: "Section Subheading", type: "textarea" },
        { key: "features.item1_title", label: "Feature 1 Title" },
        { key: "features.item1_desc", label: "Feature 1 Description", type: "textarea" },
        { key: "features.item2_title", label: "Feature 2 Title" },
        { key: "features.item2_desc", label: "Feature 2 Description", type: "textarea" },
        { key: "features.item3_title", label: "Feature 3 Title" },
        { key: "features.item3_desc", label: "Feature 3 Description", type: "textarea" },
        { key: "features.item4_title", label: "Feature 4 Title" },
        { key: "features.item4_desc", label: "Feature 4 Description", type: "textarea" },
      ],
    },
  ],
  social: [
    {
      title: "Social Proof",
      fields: [
        { key: "social.stats_customers", label: "Customer Count (e.g. 2,000+)" },
        { key: "social.stats_audits", label: "Audits Completed" },
        { key: "social.stats_countries", label: "Countries Served" },
        { key: "social.stats_rating", label: "Average Rating (e.g. 4.9)" },
        { key: "social.trusted_heading", label: "Trusted Brands Heading" },
      ],
    },
  ],
  faq: [
    {
      title: "FAQ Section",
      fields: [
        { key: "faq.heading", label: "Section Heading" },
        { key: "faq.q1", label: "Question 1" },
        { key: "faq.a1", label: "Answer 1", type: "textarea" },
        { key: "faq.q2", label: "Question 2" },
        { key: "faq.a2", label: "Answer 2", type: "textarea" },
        { key: "faq.q3", label: "Question 3" },
        { key: "faq.a3", label: "Answer 3", type: "textarea" },
        { key: "faq.q4", label: "Question 4" },
        { key: "faq.a4", label: "Answer 4", type: "textarea" },
        { key: "faq.q5", label: "Question 5" },
        { key: "faq.a5", label: "Answer 5", type: "textarea" },
      ],
    },
  ],
  footer: [
    {
      title: "Footer",
      fields: [
        { key: "footer.tagline", label: "Tagline" },
        { key: "footer.copyright", label: "Copyright Text" },
        { key: "footer.social_twitter", label: "Twitter URL" },
        { key: "footer.social_linkedin", label: "LinkedIn URL" },
        { key: "footer.social_youtube", label: "YouTube URL" },
      ],
    },
  ],
};

export default function AdminMarketingHomepage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [localData, setLocalData] = useState<CmsMap>({});
  const [dirty, setDirty] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["admin-cms-homepage"],
    queryFn: () => fetchCms("homepage"),
    onSuccess: (d: CmsMap) => { setLocalData(d); setDirty(false); },
  } as Parameters<typeof useQuery>[0]);

  const saveMutation = useMutation({
    mutationFn: (data: CmsMap) =>
      fetch(`${basePath}/api/admin/cms/homepage`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-homepage"] });
      setDirty(false);
      toast({ title: "Homepage content saved", description: "Changes are now live on the website." });
    },
  });

  function handleChange(key: string, val: string) {
    setLocalData((p) => ({ ...p, [key]: val }));
    setDirty(true);
  }

  const tabKeys = Object.keys(SECTIONS) as (keyof typeof SECTIONS)[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Home className="w-6 h-6 text-orange-500" /> Homepage CMS
          </h1>
          <p className="text-slate-500 text-sm mt-1">Edit homepage content — changes go live instantly</p>
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
          <TabsList className="flex-wrap h-auto">
            {tabKeys.map((k) => (
              <TabsTrigger key={k} value={k} className="capitalize">{k}</TabsTrigger>
            ))}
          </TabsList>
          {tabKeys.map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4 mt-4">
              {SECTIONS[tab].map((section) => (
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
