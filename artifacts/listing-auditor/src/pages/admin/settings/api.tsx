import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Save, Eye, EyeOff } from "lucide-react";

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`/api/admin/settings?category=${category}`).then((r) => r.json());
}
function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, settings }) }).then((r) => r.json());
}

export default function AdminSettingsAPI() {
  const { toast } = useToast();
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    api_rate_limit_per_minute: "60", api_rate_limit_per_day: "1000",
    api_webhook_url: "", api_webhook_secret: "",
    amazon_api_key: "", amazon_api_secret: "",
  });

  const { data } = useQuery({ queryKey: ["admin-settings-api"], queryFn: () => fetchSettings("api") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("api", form),
    onSuccess: () => toast({ title: "API settings saved" }),
  });

  const secretField = (key: keyof typeof form, label: string) => (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <div className="relative">
        <Input type={show[key] ? "text" : "password"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="pr-10" />
        <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}>
          {show[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">API Management</h1>
        </div>
        <Card>
          <CardHeader><CardTitle>Rate Limits</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Requests Per Minute</label>
              <Input type="number" value={form.api_rate_limit_per_minute} onChange={(e) => setForm({ ...form, api_rate_limit_per_minute: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Requests Per Day</label>
              <Input type="number" value={form.api_rate_limit_per_day} onChange={(e) => setForm({ ...form, api_rate_limit_per_day: e.target.value })} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Webhooks</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Webhook URL</label>
              <Input type="url" value={form.api_webhook_url} onChange={(e) => setForm({ ...form, api_webhook_url: e.target.value })} placeholder="https://your-app.com/webhooks" />
            </div>
            {secretField("api_webhook_secret", "Webhook Secret")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Amazon API Credentials</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {secretField("amazon_api_key", "Amazon API Key")}
            {secretField("amazon_api_secret", "Amazon API Secret")}
          </CardContent>
        </Card>
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving…" : "Save API Settings"}</Button>
      </div>
    </AdminLayout>
  );
}
