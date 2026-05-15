import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Lock, Save, KeyRound, Copy, Check, RefreshCw } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`${basePath}/api/admin/settings?category=${category}`, { credentials: "include" }).then((r) => r.json());
}
function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch(`${basePath}/api/admin/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ category, settings }) }).then((r) => r.json());
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

  const [showPwDialog, setShowPwDialog] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data } = useQuery({ queryKey: ["admin-settings-security"], queryFn: () => fetchSettings("security") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("security", form),
    onSuccess: () => toast({ title: "Security settings saved" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      fetch(`${basePath}/api/auth/reset-password`, { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: (result) => {
      if (result?.error) { toast({ title: result.error, variant: "destructive" }); return; }
      setNewPassword(result.newPassword);
    },
    onError: () => toast({ title: "Failed to generate password", variant: "destructive" }),
  });

  function handleOpenReset() {
    setNewPassword(null);
    setCopied(false);
    setShowPwDialog(true);
    resetPasswordMutation.mutate();
  }

  function handleCopy() {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <Lock className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Security Settings</h1>
        </div>

        {/* Admin Account Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-orange-500" />
              Admin Account Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Generate a new secure password for your admin account. The password will be shown once — copy and store it somewhere safe.
            </p>
            <Button
              variant="outline"
              onClick={handleOpenReset}
              disabled={resetPasswordMutation.isPending}
              className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Generate New Password
            </Button>
          </CardContent>
        </Card>

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

      {/* Password Reset Dialog */}
      <Dialog open={showPwDialog} onOpenChange={(open) => { if (!open) { setShowPwDialog(false); setNewPassword(null); setCopied(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
              <KeyRound className="w-7 h-7 text-blue-500" />
            </div>
            <DialogTitle>New Admin Password Generated</DialogTitle>
            <DialogDescription className="text-center pt-1">
              {resetPasswordMutation.isPending
                ? "Generating a new secure password for your admin account..."
                : "Your password has been updated. Copy and store it securely — it will not be shown again."}
            </DialogDescription>
          </DialogHeader>
          {resetPasswordMutation.isPending ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : newPassword ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3 my-2">
              <span className="font-mono text-sm font-semibold text-slate-800 tracking-wider break-all">{newPassword}</span>
              <Button
                variant="ghost"
                size="sm"
                className={`flex-shrink-0 h-8 px-2 ${copied ? "text-green-600" : "text-slate-500 hover:text-slate-900"}`}
                onClick={handleCopy}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => { setShowPwDialog(false); setNewPassword(null); setCopied(false); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
