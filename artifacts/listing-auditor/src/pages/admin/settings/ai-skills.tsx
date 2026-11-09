import { Link } from "wouter";
import { ImageIcon, Plus, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminAiSkillsOverview } from "@/lib/admin-ai-skills-overview";

export default function AdminAiSkillsPage() {
  const {
    isLoading,
    enabledMarketplaces,
    marketplaces,
    enabledGraphics,
    enabledAplus,
    graphicsTemplates,
    coverageRows,
  } = useAdminAiSkillsOverview();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Skills</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Content and image capabilities users get per category. Edit sources in Marketplace Content and Image Prompts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/settings/content-marketplaces">
            <Button variant="outline" className="gap-2">
              <Store className="w-4 h-4" />
              Marketplace Content
            </Button>
          </Link>
          <Link href="/admin/settings/image-prompt-templates">
            <Button variant="outline" className="gap-2">
              <ImageIcon className="w-4 h-4" />
              Image Prompts
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content skills</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enabled content marketplaces power listing generation ({enabledMarketplaces.length} live).
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && marketplaces.length === 0 && (
            <p className="text-sm text-muted-foreground">No marketplaces defined yet.</p>
          )}
          {marketplaces.map((mp) => (
            <div
              key={mp.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div>
                <p className="font-medium text-sm">{mp.name}</p>
                <p className="text-xs text-muted-foreground">{mp.slug}</p>
              </div>
              <Badge variant={mp.enabled ? "default" : "secondary"}>
                {mp.enabled ? "Live" : "Draft"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Image skills</CardTitle>
          <p className="text-sm text-muted-foreground">
            Graphics ({enabledGraphics.length} live) and A+ ({enabledAplus.length} live) prompt templates.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {graphicsTemplates.map((t) => (
            <div
              key={`${t.category}-${t.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div>
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.category} · {t.slug}
                </p>
              </div>
              <Badge variant={t.enabled ? "default" : "secondary"}>
                {t.enabled ? "Live" : "Draft"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Category readiness</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Pair content + image skills with approved reference images per product category.
            </p>
          </div>
          <Link href="/admin/settings/image-prompt-templates">
            <Button size="sm" variant="secondary" className="gap-1">
              <Plus className="w-3.5 h-3.5" />
              Add refs in Image Prompts
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Content</th>
                <th className="py-2 pr-4">Image</th>
                <th className="py-2 pr-4">Refs</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {coverageRows.map((row) => (
                <tr key={row.category} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium">{row.category}</td>
                  <td className="py-2 pr-4">{row.contentSkillLabel}</td>
                  <td className="py-2 pr-4">{row.imageSkillLabel}</td>
                  <td className="py-2 pr-4 tabular-nums">{row.approvedRefCount}</td>
                  <td className="py-2">
                    {row.status === "ready" ? "Ready" : "Needs setup"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
