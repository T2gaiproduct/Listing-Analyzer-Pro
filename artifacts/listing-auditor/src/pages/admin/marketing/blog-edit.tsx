import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Eye, RefreshCw, Image } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featuredImage: string | null;
  status: string;
  category: string | null;
  tags: string[];
  author: string | null;
  readMinutes: number;
  seoTitle: string | null;
  seoDescription: string | null;
  scheduledAt: string | null;
}

const emptyPost = { title: "", slug: "", excerpt: "", content: "", featuredImage: "", status: "draft", category: "", tagsText: "", author: "", readMinutes: 5, seoTitle: "", seoDescription: "", scheduledAt: "" };

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

export default function AdminBlogEdit({ postId }: { postId: string }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isNew = postId === "new";
  const [form, setForm] = useState(emptyPost);
  const [autoSlug, setAutoSlug] = useState(true);

  const { data: post } = useQuery<BlogPost>({
    queryKey: ["admin-blog-post", postId],
    queryFn: () => fetch(`${basePath}/api/admin/blog/${postId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !isNew,
  });

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title, slug: post.slug, excerpt: post.excerpt ?? "", content: post.content ?? "",
        featuredImage: post.featuredImage ?? "", status: post.status, category: post.category ?? "",
        tagsText: post.tags?.join(", ") ?? "", author: post.author ?? "", readMinutes: post.readMinutes,
        seoTitle: post.seoTitle ?? "", seoDescription: post.seoDescription ?? "", scheduledAt: post.scheduledAt ?? "",
      });
      setAutoSlug(false);
    }
  }, [post]);

  const saveMutation = useMutation({
    mutationFn: (body: object) => {
      const url = isNew ? `${basePath}/api/admin/blog` : `${basePath}/api/admin/blog/${postId}`;
      const method = isNew ? "POST" : "PATCH";
      return fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-blog"] });
      toast({ title: isNew ? "Post created" : "Post saved" });
      if (isNew && data.id) setLocation(`/admin/marketing/blog/${data.id}`);
    },
  });

  function f(key: keyof typeof emptyPost) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = e.target.type === "number" ? Number(e.target.value) as unknown as string : e.target.value;
      setForm((p) => {
        const next = { ...p, [key]: val };
        if (key === "title" && autoSlug) next.slug = slugify(val as string);
        return next;
      });
    };
  }

  function buildPayload() {
    return {
      title: form.title, slug: form.slug, excerpt: form.excerpt || null, content: form.content || null,
      featuredImage: form.featuredImage || null, status: form.status, category: form.category || null,
      tags: form.tagsText ? form.tagsText.split(",").map((t) => t.trim()).filter(Boolean) : [],
      author: form.author || null, readMinutes: Number(form.readMinutes),
      seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null,
      scheduledAt: form.scheduledAt || null,
      publishedAt: form.status === "published" ? (post?.status !== "published" ? new Date().toISOString() : undefined) : null,
    };
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/marketing/blog")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> All Posts
        </Button>
        <div className="flex gap-2">
          {form.slug && <Button variant="outline" size="sm" onClick={() => window.open(`/blog/${form.slug}`, "_blank")}><Eye className="w-4 h-4 mr-1.5" />Preview</Button>}
          <Button className="bg-orange-500 hover:bg-orange-600" size="sm" disabled={saveMutation.isPending || !form.title} onClick={() => saveMutation.mutate(buildPayload())}>
            {saveMutation.isPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            {isNew ? "Create Post" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div>
                <Label className="text-xs">Post Title *</Label>
                <Input className="mt-1 text-xl font-semibold h-11 border-slate-200" value={form.title} onChange={f("title")} placeholder="Write a compelling title..." />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-400 whitespace-nowrap">Slug:</Label>
                <div className="flex items-center flex-1">
                  <span className="text-xs text-slate-400 bg-slate-50 border border-r-0 rounded-l px-2 h-8 flex items-center">/blog/</span>
                  <Input className="h-8 text-sm rounded-l-none text-slate-600 flex-1" value={form.slug} onChange={(e) => { setAutoSlug(false); setForm((p) => ({ ...p, slug: e.target.value })); }} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Excerpt / Summary</Label>
                <Textarea className="mt-1 text-sm resize-none" rows={2} value={form.excerpt} onChange={f("excerpt")} placeholder="A short summary shown in blog listings..." />
              </div>
              <div>
                <Label className="text-xs">Content (Markdown supported)</Label>
                <Textarea className="mt-1 text-sm font-mono resize-y min-h-[400px]" value={form.content} onChange={f("content")} placeholder="Write your blog post content here..." />
              </div>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">SEO Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Meta Title</Label>
                  <span className="text-xs text-slate-400">{(form.seoTitle || form.title).length}/60 chars</span>
                </div>
                <Input className="mt-1 h-8 text-sm" value={form.seoTitle} onChange={f("seoTitle")} placeholder={form.title} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Meta Description</Label>
                  <span className="text-xs text-slate-400">{(form.seoDescription || form.excerpt).length}/160 chars</span>
                </div>
                <Textarea className="mt-1 text-sm resize-none" rows={2} value={form.seoDescription} onChange={f("seoDescription")} placeholder={form.excerpt} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Publish Settings</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.status === "scheduled" && (
                <div>
                  <Label className="text-xs">Schedule Date/Time</Label>
                  <Input className="mt-1 h-8 text-sm" type="datetime-local" value={form.scheduledAt} onChange={f("scheduledAt")} />
                </div>
              )}
              <div>
                <Label className="text-xs">Author</Label>
                <Input className="mt-1 h-8 text-sm" value={form.author} onChange={f("author")} placeholder="Jane Smith" />
              </div>
              <div>
                <Label className="text-xs">Read Time (minutes)</Label>
                <Input className="mt-1 h-8 text-sm" type="number" min={1} value={form.readMinutes} onChange={f("readMinutes")} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Categorization</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Input className="mt-1 h-8 text-sm" value={form.category} onChange={f("category")} placeholder="Amazon Tips" />
              </div>
              <div>
                <Label className="text-xs">Tags (comma-separated)</Label>
                <Input className="mt-1 h-8 text-sm" value={form.tagsText} onChange={f("tagsText")} placeholder="seo, listing, amazon" />
                {form.tagsText && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {form.tagsText.split(",").filter((t) => t.trim()).map((t) => <Badge key={t} variant="secondary" className="text-xs">{t.trim()}</Badge>)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Image className="w-4 h-4" />Featured Image</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input className="h-8 text-sm" value={form.featuredImage} onChange={f("featuredImage")} placeholder="https://..." />
              {form.featuredImage && (
                <img src={form.featuredImage} alt="Featured" className="w-full h-32 object-cover rounded-lg border border-slate-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
