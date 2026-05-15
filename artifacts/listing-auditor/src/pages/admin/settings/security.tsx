import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Save, KeyRound, Eye, EyeOff } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchSettings(category: string): Promise<Record<string, string>> {
  return fetch(`${basePath}/api/admin/settings?category=${category}`, { credentials: "include" }).then((r) => r.json());
}
function saveSettings(category: string, settings: Record<string, string>): Promise<unknown> {
  return fetch(`${basePath}/api/admin/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ category, settings }) }).then((r) => r.json());
}

export default function AdminSettingsSecurity() {
  const { user } = useUser();
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
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "", logoutAll: false });
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data } = useQuery({ queryKey: ["admin-settings-security"], queryFn: () => fetchSettings("security") });
  useEffect(() => { if (data) setForm((f) => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings("security", form),
    onSuccess: () => toast({ title: "Security settings saved" }),
  });

  function openPwDialog() {
    setPwForm({ current: "", newPw: "", confirm: "", logoutAll: false });
    setPwError("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setShowPwDialog(true);
  }

  async function handleChangePassword() {
    if (!user) return;
    if (!pwForm.current) { setPwError("Current password is required"); return; }
    if (!pwForm.newPw) { setPwError("New password is required"); return; }
    if (pwForm.newPw.length < 8) { setPwError("New password must be at least 8 characters"); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError("Passwords do not match"); return; }
    setPwSaving(true);
    setPwError("");
    try {
      await user.updatePassword({
        currentPassword: pwForm.current,
        newPassword: pwForm.newPw,
        signOutOfOtherSessions: pwForm.logoutAll,
      });
      setShowPwDialog(false);
      toast({ title: "Password changed successfully" });
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ message: string }>; message?: string };
      setPwError(clerkErr?.errors?.[0]?.message ?? clerkErr?.message ?? "Failed to change password. Check your current password.");
    } finally {
      setPwSaving(false);
    }
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
              Change your admin account password. You will need to enter your current password to confirm.
            </p>
            <Button
              variant="outline"
              onClick={openPwDialog}
              className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Change Password
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

      {/* Change Password Dialog */}
      <Dialog open={showPwDialog} onOpenChange={(open) => { if (!open) setShowPwDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="curr-pw">Your current password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  id="curr-pw"
                  type={showCurrent ? "text" : "password"}
                  value={pwForm.current}
                  onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                  className="pr-10"
                  autoComplete="current-password"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowCurrent((v) => !v)}>
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNew ? "text" : "password"}
                  value={pwForm.newPw}
                  onChange={(e) => setPwForm((f) => ({ ...f, newPw: e.target.value }))}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowNew((v) => !v)}>
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conf-pw">Confirm new password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  id="conf-pw"
                  type={showConfirm ? "text" : "password"}
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowConfirm((v) => !v)}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="logout-all-admin"
                checked={pwForm.logoutAll}
                onCheckedChange={(checked) => setPwForm((f) => ({ ...f, logoutAll: !!checked }))}
              />
              <Label htmlFor="logout-all-admin" className="text-sm font-normal cursor-pointer">Log me out of all devices</Label>
            </div>
            {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPwDialog(false)} disabled={pwSaving}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleChangePassword} disabled={pwSaving}>
              {pwSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
