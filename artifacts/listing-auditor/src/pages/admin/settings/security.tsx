import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Lock, Save } from "lucide-react";

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`/api/admin/settings?category=${category}`).then((r) => r.json());
}
function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, settings }) }).then((r) => r.json());
}

export default function AdminSettingsSecurity() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    security_session_timeout_minutes: "60",
    security_max_login_attempts: "5",
    security_lockout_duration_minutes: "15",
    security_min_password_length: "8",
    security_require_2fa_for_admin: "true",
    security_allowed_ips: "",
    security_blocked_countries: "",
  });

  const { data } = useQuery({ queryKey: ["admin-settings-security"], queryFn: () => fetchSettings("security") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("security", form),
    onSuccess: () => toast({ title: "Security settings saved" }),
  });

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <Lock className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Security Settings</h1>
        </div>
        <Card>
          <CardHeader><CardTitle>Session &amp; Auth</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Session Timeout (minutes)</label>
              <Input type="number" value={form.security_session_timeout_minutes} onChange={(e) => setForm({ ...form, security_session_timeout_minutes: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Max Login Attempts</label>
              <Input type="number" value={form.security_max_login_attempts} onChange={(e) => setForm({ ...form, security_max_login_attempts: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Lockout Duration (minutes)</label>
              <Input type="number" value={form.security_lockout_duration_minutes} onChange={(e) => setForm({ ...form, security_lockout_duration_minutes: e.target.value })} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Password Policy</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Minimum Password Length</label>
              <Input type="number" min="6" max="32" value={form.security_min_password_length} onChange={(e) => setForm({ ...form, security_min_password_length: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Require 2FA for Admins</label>
              <select value={form.security_require_2fa_for_admin} onChange={(e) => setForm({ ...form, security_require_2fa_for_admin: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>IP &amp; Geo Restrictions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Allowed IP Whitelist (one per line)</label>
              <Textarea rows={4} placeholder="192.168.1.0/24&#10;10.0.0.1" value={form.security_allowed_ips} onChange={(e) => setForm({ ...form, security_allowed_ips: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Blocked Countries (comma-separated ISO codes)</label>
              <Input placeholder="CN, RU, KP" value={form.security_blocked_countries} onChange={(e) => setForm({ ...form, security_blocked_countries: e.target.value })} />
            </div>
          </CardContent>
        </Card>
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving…" : "Save Security Settings"}</Button>
      </div>
    </AdminLayout>
  );
}
