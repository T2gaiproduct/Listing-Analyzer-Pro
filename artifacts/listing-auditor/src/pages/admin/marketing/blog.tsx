import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, Eye, BookOpen, Search, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  category: string | null;
  tags: string[];
  author: string | null;
  readMinutes: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  featuredImage: string | null;
  createdAt: string;
}

export default function AdminMarketingBlog() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["admin-blog", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return fetch(`${basePath}/api/admin/blog?${params}`, { credentials: "include" }).then((r) => r.json());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${basePath}/api/admin/blog/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-blog"] }); toast({ title: "Post deleted" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`${basePath}/api/admin/blog/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, publishedAt: status === "published" ? new Date().toISOString() : null }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog"] }),
  });

  function statusBadge(status: string) {
    if (status === "published") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Published</Badge>;
    if (status === "scheduled") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Scheduled</Badge>;
    return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Draft</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-orange-500" /> Blog Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">{posts.length} posts total</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setLocation("/admin/marketing/blog/new")}>
          <Plus className="w-4 h-4 mr-2" /> New Post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-9 h-8 text-sm" placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-1 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No posts yet</p>
              <p className="text-slate-400 text-sm">Write your first blog post to attract visitors</p>
              <Button className="mt-4 bg-orange-500 hover:bg-orange-600" size="sm" onClick={() => setLocation("/admin/marketing/blog/new")}>
                <Plus className="w-4 h-4 mr-1.5" /> Create First Post
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Title</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Category</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-slate-50 hover:bg-orange-50/30 group">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 truncate max-w-[280px] group-hover:text-orange-700 transition-colors">{post.title}</p>
                      {post.excerpt && <p className="text-xs text-slate-400 truncate max-w-[280px] mt-0.5">{post.excerpt}</p>}
                      {post.tags?.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {post.tags.slice(0, 3).map((t) => <span key={t} className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{t}</span>)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {post.category ? <span className="text-xs bg-orange-50 text-orange-600 rounded px-2 py-0.5 flex items-center gap-1 w-fit"><Tag className="w-3 h-3" />{post.category}</span> : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3">{statusBadge(post.status)}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {post.publishedAt ? format(new Date(post.publishedAt), "MMM d, yyyy") : format(new Date(post.createdAt), "MMM d, yyyy")}
                      <br />
                      <span className="text-slate-300">{post.readMinutes} min read</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-slate-700" onClick={() => window.open(`/blog/${post.slug}`, "_blank")} title="Preview">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-orange-600" onClick={() => setLocation(`/admin/marketing/blog/${post.id}`)} title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className={`h-7 px-2 text-xs ${post.status === "published" ? "text-slate-400 hover:text-yellow-600" : "text-slate-400 hover:text-green-600"}`}
                          title={post.status === "published" ? "Unpublish" : "Publish"}
                          onClick={() => toggleMutation.mutate({ id: post.id, status: post.status === "published" ? "draft" : "published" })}
                        >
                          {post.status === "published" ? "Unpublish" : "Publish"}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-red-600" onClick={() => confirm(`Delete "${post.title}"?`) && deleteMutation.mutate(post.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
