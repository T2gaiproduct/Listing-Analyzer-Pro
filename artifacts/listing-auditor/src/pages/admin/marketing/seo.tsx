import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Search, TrendingUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SeoRecord {
  id?: number;
  pageSlug: string;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  schemaMarkup: string | null;
}

const PAGES = [
  { slug: "home", label: "Home Page" },
  { slug: "features", label: "Features" },
  { slug: "pricing", label: "Pricing" },
  { slug: "about", label: "About Us" },
  { slug: "contact", label: "Contact Us" },
  { slug: "blog", label: "Blog" },
  { slug: "help", label: "Help Center" },
  { slug: "terms", label: "Terms & Conditions" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "enterprise", label: "Enterprise" },
];

const emptyForm = { metaTitle: "", metaDescription: "", keywords: "", ogTitle: "", ogDescription: "", ogImage: "", schemaMarkup: "" };

export default function AdminMarketingSeo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedPage, setSelectedPage] = useState("home");
  const [form, setForm] = useState(emptyForm);
  const [dirty, setDirty] = useState(false);

  const { isLoading, data: seoData } = useQuery<SeoRecord>({
    queryKey: ["admin-seo", selectedPage],
    queryFn: () => fetch(`${basePath}/api/admin/seo/${selectedPage}`, { credentials: "include" }).then((r) => r.json()),
  });

  useEffect(() => {
    if (seoData) {
      setForm({ metaTitle: seoData.metaTitle ?? "", metaDescription: seoData.metaDescription ?? "", keywords: seoData.keywords ?? "", ogTitle: seoData.ogTitle ?? "", ogDescription: seoData.ogDescription ?? "", ogImage: seoData.ogImage ?? "", schemaMarkup: seoData.schemaMarkup ?? "" });
      setDirty(false);
    }
  }, [seoData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch(`${basePath}/api/admin/seo/${selectedPage}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageSlug: selectedPage, ...form }) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-seo", selectedPage] }); setDirty(false); toast({ title: "SEO settings saved" }); },
  });

  function f(key: keyof typeof emptyForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm((p) => ({ ...p, [key]: e.target.value })); setDirty(true); };
  }

  const titleLen = form.metaTitle.length;
  const descLen = form.metaDescription.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-orange-500" /> SEO Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage meta tags, Open Graph, and schema for each page</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" size="sm" disabled={!dirty || saveMutation.isPending || isLoading} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Save SEO
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm text-slate-600 whitespace-nowrap">Editing page:</Label>
        <Select value={selectedPage} onValueChange={(v) => { setSelectedPage(v); setDirty(false); }}>
          <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGES.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* Meta tags */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Search className="w-4 h-4 text-orange-500" />Search Engine</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Meta Title</Label>
                  <span className={`text-xs ${titleLen > 60 ? "text-red-500" : titleLen > 50 ? "text-yellow-500" : "text-slate-400"}`}>{titleLen}/60</span>
                </div>
                <Input className="mt-1 h-8 text-sm" value={form.metaTitle} onChange={f("metaTitle")} placeholder={`${PAGES.find(p => p.slug === selectedPage)?.label} | Your Brand`} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Meta Description</Label>
                  <span className={`text-xs ${descLen > 160 ? "text-red-500" : descLen > 140 ? "text-yellow-500" : "text-slate-400"}`}>{descLen}/160</span>
                </div>
                <Textarea className="mt-1 text-sm resize-none" rows={3} value={form.metaDescription} onChange={f("metaDescription")} placeholder="Describe this page for search engines..." />
              </div>
              <div>
                <Label className="text-xs">Keywords (comma-separated)</Label>
                <Input className="mt-1 h-8 text-sm" value={form.keywords} onChange={f("keywords")} placeholder="amazon listing, product audit, seller tools" />
              </div>
              {/* Preview */}
              {(form.metaTitle || form.metaDescription) && (
                <div className="bg-white border border-slate-200 rounded-lg p-3 mt-2">
                  <p className="text-xs text-slate-400 mb-1.5 font-medium">Search Preview</p>
                  <p className="text-blue-600 text-sm font-medium truncate">{form.metaTitle || "Page Title"}</p>
                  <p className="text-green-700 text-xs">yoursite.com/{selectedPage}</p>
                  <p className="text-slate-600 text-xs mt-0.5 line-clamp-2">{form.metaDescription || "Page description..."}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open Graph */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Open Graph (Social Sharing)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">OG Title</Label>
                <Input className="mt-1 h-8 text-sm" value={form.ogTitle} onChange={f("ogTitle")} placeholder={form.metaTitle || "Social share title"} />
              </div>
              <div>
                <Label className="text-xs">OG Description</Label>
                <Textarea className="mt-1 text-sm resize-none" rows={3} value={form.ogDescription} onChange={f("ogDescription")} placeholder={form.metaDescription || "Social share description..."} />
              </div>
              <div>
                <Label className="text-xs">OG Image URL</Label>
                <Input className="mt-1 h-8 text-sm" value={form.ogImage} onChange={f("ogImage")} placeholder="https://..." />
                {form.ogImage && <img src={form.ogImage} alt="" className="mt-2 w-full h-28 object-cover rounded border border-slate-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              </div>
            </CardContent>
          </Card>

          {/* Schema */}
          <Card className="border-0 shadow-sm col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Schema Markup (JSON-LD)</CardTitle></CardHeader>
            <CardContent>
              <Textarea className="font-mono text-xs resize-y min-h-[120px]" value={form.schemaMarkup} onChange={f("schemaMarkup")} placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "SoftwareApplication",\n  "name": "Your App"\n}'} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
