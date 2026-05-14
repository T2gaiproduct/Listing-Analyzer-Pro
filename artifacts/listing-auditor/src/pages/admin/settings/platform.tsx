import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save } from "lucide-react";

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`/api/admin/settings?category=${category}`).then((r) => r.json());
}

function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, settings }) }).then((r) => r.json());
}

export default function AdminSettingsPlatform() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    platform_name: "ListingAuditor", support_email: "", support_phone: "",
    company_address: "", timezone: "UTC", default_language: "en",
    max_audits_per_user: "100", maintenance_mode: "false",
  });

  const { data } = useQuery({ queryKey: ["admin-settings-platform"], queryFn: () => fetchSettings("platform") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("platform", form),
    onSuccess: () => toast({ title: "Settings saved" }),
  });

  const field = (key: keyof typeof form, label: string, type: string = "text", multiline?: boolean) => (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      {multiline
        ? <Textarea value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={3} />
        : <Input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      }
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Platform Settings</h1>
        </div>
        <Card>
          <CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {field("platform_name", "Platform Name")}
            {field("support_email", "Support Email", "email")}
            {field("support_phone", "Support Phone")}
            {field("company_address", "Company Address", "text", true)}
            {field("timezone", "Default Timezone")}
            {field("default_language", "Default Language")}
            {field("max_audits_per_user", "Max Audits Per User", "number")}
          </CardContent>
        </Card>
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving…" : "Save Settings"}</Button>
      </div>
    </AdminLayout>
  );
}
