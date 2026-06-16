import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { User, Building2, Phone, Globe, Edit2, Save, X, FileText, Link, Users, KeyRound, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES } from "@/lib/countries";
import { format } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ProfileData {
  profile: {
    id: number;
    userId: string;
    fullName: string | null;
    companyName: string | null;
    phone: string | null;
    country: string | null;
    gstNumber: string | null;
    websiteUrl: string | null;
    teamSize: number | null;
    onboardingCompleted: boolean;
    createdAt: string;
  } | null;
  subscription: {
    status: string;
    planName: string | null;
    planId: number | null;
    billingCycle: string;
    priceMonthly: number;
    priceYearly: number;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cardLast4: string | null;
    cardBrand: string | null;
    autoRenew: boolean;
    couponCode: string | null;
    discountAmount: number | null;
    planAiCredits: number;
    planImageCredits: number;
    planAuditCredits: number;
  } | null;
  credits: {
    aiCredits: number;
    imageCredits: number;
    auditCredits: number;
  };
  transactions: {
    id: number;
    creditType: string;
    amount: number;
    reason: string | null;
    featureType: string | null;
    createdAt: string;
  }[];
  billingHistory: {
    id: number;
    amount: number;
    currency: string;
    status: string;
    gateway: string;
    createdAt: string;
  }[];
}

interface Plan {
  id: number;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  aiCredits: number;
  imageCredits: number;
  auditCredits: number;
  tag: string | null;
  isHighlighted: boolean;
}

export default function Profile() {
  const { user } = useUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showPwDialog, setShowPwDialog] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "", logoutAll: false });
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    fullName: "", companyName: "", phone: "", country: "",
    gstNumber: "", websiteUrl: "", teamSize: "",
  });

  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ["user-profile"],
    queryFn: () => fetch(`${basePath}/api/profile`, { credentials: "include" }).then((r) => r.json()),
  });

  useEffect(() => {
    if (data?.profile) {
      setForm({
        fullName: data.profile.fullName ?? user?.fullName ?? "",
        companyName: data.profile.companyName ?? "",
        phone: data.profile.phone ?? "",
        country: data.profile.country ?? "",
        gstNumber: data.profile.gstNumber ?? "",
        websiteUrl: data.profile.websiteUrl ?? "",
        teamSize: data.profile.teamSize?.toString() ?? "",
      });
    }
  }, [data, user]);

  const updateMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/profile`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user-profile"] }); setEditing(false); toast({ title: "Profile updated" }); },
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

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <>
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account details and subscription</p>
      </div>

      {/* Profile info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={user.fullName ?? "Avatar"} className="w-14 h-14 rounded-full object-cover ring-2 ring-orange-100" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                <User className="w-7 h-7 text-orange-500" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{form.fullName || user?.fullName || "Your Name"}</CardTitle>
              <p className="text-sm text-slate-400">{user?.primaryEmailAddress?.emailAddress}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {data?.profile?.id && (
                  <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                    {`CUST-${String(data.profile.id).padStart(5, "0")}`}
                  </span>
                )}
                {data?.profile?.createdAt && (
                  <p className="text-xs text-slate-400">Member since {format(new Date(data.profile.createdAt), "MMMM yyyy")}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openPwDialog}>
              <KeyRound className="w-4 h-4 mr-1" />Change Password
            </Button>
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => updateMutation.mutate({ ...form, teamSize: form.teamSize ? Number(form.teamSize) : undefined })} disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-1" />{updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit2 className="w-4 h-4 mr-1" />Edit Profile</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><User className="w-3 h-3" />Full Name</Label>
              {editing ? (
                <Input className="mt-1 h-8 text-sm" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
              ) : (
                <p className="text-sm font-medium text-slate-800 mt-1">{form.fullName || <span className="text-slate-400 italic">Not set</span>}</p>
              )}
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Building2 className="w-3 h-3" />Company / Brand</Label>
              {editing ? (
                <Input className="mt-1 h-8 text-sm" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
              ) : (
                <p className="text-sm font-medium text-slate-800 mt-1">{form.companyName || <span className="text-slate-400 italic">Not set</span>}</p>
              )}
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><User className="w-3 h-3" />Email Address</Label>
              <p className="text-sm text-slate-600 mt-1">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Phone className="w-3 h-3" />Phone Number</Label>
              {editing ? (
                <Input className="mt-1 h-8 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
              ) : (
                <p className="text-sm font-medium text-slate-800 mt-1">{form.phone || <span className="text-slate-400 italic">Not set</span>}</p>
              )}
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Globe className="w-3 h-3" />Country</Label>
              {editing ? (
                <select
                  className="mt-1 w-full h-8 border border-input rounded-md bg-background px-3 text-sm"
                  value={form.country}
                  onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                >
                  <option value="">Select your country</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <p className="text-sm font-medium text-slate-800 mt-1">{form.country || <span className="text-slate-400 italic">Not set</span>}</p>
              )}
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Users className="w-3 h-3" />Team Size</Label>
              {editing ? (
                <Input className="mt-1 h-8 text-sm" type="number" value={form.teamSize} onChange={(e) => setForm((p) => ({ ...p, teamSize: e.target.value }))} placeholder="e.g. 5" />
              ) : (
                <p className="text-sm font-medium text-slate-800 mt-1">{form.teamSize || <span className="text-slate-400 italic">Not set</span>}</p>
              )}
            </div>
          </div>

          {/* Optional fields */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Additional Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs flex items-center gap-1.5 text-slate-500"><FileText className="w-3 h-3" />GST / Tax Number</Label>
                {editing ? (
                  <Input className="mt-1 h-8 text-sm" value={form.gstNumber} onChange={(e) => setForm((p) => ({ ...p, gstNumber: e.target.value }))} placeholder="GST1234567890" />
                ) : (
                  <p className="text-sm font-medium text-slate-800 mt-1">{form.gstNumber || <span className="text-slate-400 italic">Not set</span>}</p>
                )}
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1.5 text-slate-500"><Link className="w-3 h-3" />Website URL</Label>
                {editing ? (
                  <Input className="mt-1 h-8 text-sm" value={form.websiteUrl} onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))} placeholder="https://yourstore.com" />
                ) : (
                  <p className="text-sm font-medium text-slate-800 mt-1">
                    {form.websiteUrl
                      ? <a href={form.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{form.websiteUrl}</a>
                      : <span className="text-slate-400 italic">Not set</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>

    {/* Change Password Dialog */}
    <Dialog open={showPwDialog} onOpenChange={(open) => { if (!open) setShowPwDialog(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="prof-curr-pw">Your current password <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                id="prof-curr-pw"
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
            <Label htmlFor="prof-new-pw">New password <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                id="prof-new-pw"
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
            <Label htmlFor="prof-conf-pw">Confirm new password <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                id="prof-conf-pw"
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
              id="prof-logout-all"
              checked={pwForm.logoutAll}
              onCheckedChange={(checked) => setPwForm((f) => ({ ...f, logoutAll: !!checked }))}
            />
            <Label htmlFor="prof-logout-all" className="text-sm font-normal cursor-pointer">Log me out of all devices</Label>
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
