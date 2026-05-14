import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, PenLine } from "lucide-react";

interface ContentItem {
  id: number; userId: string; productName: string;
  generatedContent: { title: string; bulletPoints: string[]; keywords: string[] } | null;
  createdAt: string;
}

function fetchContent(): Promise<{ content: ContentItem[] }> {
  return fetch("/api/admin/content").then((r) => r.json());
}

export default function AdminContentGenerated() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-content"], queryFn: fetchContent });
  const items = data?.content ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Generated Content</h1>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No generated content found.</Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold">{item.productName}</span>
                    <Badge variant="outline">#{item.id}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                {item.generatedContent && (
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Title:</span> {item.generatedContent.title}</div>
                    <div><span className="font-medium">Bullets:</span> {item.generatedContent.bulletPoints.slice(0, 3).join(" / ")}</div>
                    <div><span className="font-medium">Keywords:</span> {item.generatedContent.keywords.slice(0, 5).join(", ")}</div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
