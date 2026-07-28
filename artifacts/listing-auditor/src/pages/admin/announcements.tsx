import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Megaphone, RefreshCw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ANNOUNCEMENT_PROMO_CATEGORY,
  ANNOUNCEMENT_PROMO_KEYS,
  announcementPromoFormDefaults,
} from "@/lib/announcement-promo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`${basePath}/api/admin/settings?category=${category}`, { credentials: "include" }).then((r) => r.json());
}

function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch(`${basePath}/api/admin/settings`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, settings }),
  }).then((r) => r.json());
}

export default function AdminAnnouncements() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>(() => announcementPromoFormDefaults());
  const [dirty, setDirty] = useState(false);

  const { isLoading, data: settings } = useQuery({
    queryKey: ["admin-announcement-promo"],
    queryFn: () => fetchSettings(ANNOUNCEMENT_PROMO_CATEGORY),
  });

  useEffect(() => {
    if (settings && !dirty) {
      setForm(announcementPromoFormDefaults(settings));
    }
  }, [settings, dirty]);

  const saveMutation = useMutation({
    mutationFn: () => saveSettings(ANNOUNCEMENT_PROMO_CATEGORY, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcement-promo"] });
      qc.invalidateQueries({ queryKey: ["announcement-promo"] });
      setDirty(false);
      toast({ title: "Announcement saved", description: "The homepage promo banner is updated." });
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const enabled = form[ANNOUNCEMENT_PROMO_KEYS.enabled] !== "false";

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Megaphone className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500 flex-shrink-0" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Public homepage promo bar and site-wide announcement messaging.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homepage promo banner</CardTitle>
          <CardDescription>
            The dark bar at the top of the public homepage. Manage promo text, coupon code, and link here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Show promo banner</p>
              <p className="text-xs text-slate-500 mt-0.5">Visitors can dismiss it for their browser session.</p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => updateField(ANNOUNCEMENT_PROMO_KEYS.enabled, checked ? "true" : "false")}
            />
          </div>

          <div>
            <Label className="text-xs text-slate-500">Promo text (before code)</Label>
            <Input
              className="mt-1"
              value={form[ANNOUNCEMENT_PROMO_KEYS.text] ?? ""}
              onChange={(e) => updateField(ANNOUNCEMENT_PROMO_KEYS.text, e.target.value)}
              placeholder="Launch offer: Get 20% off any plan with code"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Promo code</Label>
              <Input
                className="mt-1 font-mono"
                value={form[ANNOUNCEMENT_PROMO_KEYS.code] ?? ""}
                onChange={(e) => updateField(ANNOUNCEMENT_PROMO_KEYS.code, e.target.value)}
                placeholder="LAUNCH20"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Link text</Label>
              <Input
                className="mt-1"
                value={form[ANNOUNCEMENT_PROMO_KEYS.linkText] ?? ""}
                onChange={(e) => updateField(ANNOUNCEMENT_PROMO_KEYS.linkText, e.target.value)}
                placeholder="See pricing"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-500">Link URL</Label>
            <Input
              className="mt-1"
              value={form[ANNOUNCEMENT_PROMO_KEYS.linkUrl] ?? ""}
              onChange={(e) => updateField(ANNOUNCEMENT_PROMO_KEYS.linkUrl, e.target.value)}
              placeholder="/pricing"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-900 text-white text-sm py-2.5 px-4">
            <span className="text-orange-400 font-semibold">{form[ANNOUNCEMENT_PROMO_KEYS.text] || "Promo text"}</span>{" "}
            <code className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-mono text-xs">
              {form[ANNOUNCEMENT_PROMO_KEYS.code] || "CODE"}
            </code>
            {form[ANNOUNCEMENT_PROMO_KEYS.linkText] && (
              <span className="ml-2 text-orange-300 underline">{form[ANNOUNCEMENT_PROMO_KEYS.linkText]}</span>
            )}
          </div>

          <Button
            className="bg-orange-500 hover:bg-orange-600"
            disabled={!dirty || saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save announcement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
