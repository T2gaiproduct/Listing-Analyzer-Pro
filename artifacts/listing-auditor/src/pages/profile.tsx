import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { User, Building2, Phone, Globe, Edit2, Save, X, FileText, Link, Users, KeyRound, Eye, EyeOff, Camera, ZoomIn, ZoomOut, Move } from "lucide-react";
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

function resolveClerkName(user: ReturnType<typeof useUser>["user"]): string {
  if (!user) return "";
  return user.fullName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

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
    avatarUrl: string | null;
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop modal state
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    fullName: "", companyName: "", phone: "", country: "",
    gstNumber: "", websiteUrl: "", teamSize: "",
  });

  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ["user-profile"],
    queryFn: () => fetch(`${basePath}/api/profile`, { credentials: "include" }).then((r) => r.json()),
  });

  useEffect(() => {
    if (isLoading) return;
    const p = data?.profile;
    const clerkName = resolveClerkName(user);
    setForm({
      fullName: p?.fullName ?? clerkName ?? "",
      companyName: p?.companyName ?? "",
      phone: p?.phone ?? "",
      country: p?.country ?? "",
      gstNumber: p?.gstNumber ?? "",
      websiteUrl: p?.websiteUrl ?? "",
      teamSize: p?.teamSize?.toString() ?? "",
    });
  }, [data, user, isLoading]);

  const updateMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${basePath}/api/profile`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["user-profile"] });
      qc.invalidateQueries({ queryKey: ["user-profile-summary"] });
      qc.setQueryData(["user-profile-summary"], (prev: {
        profile?: { fullName?: string | null };
        accountRole?: { type: string; label: string };
      } | undefined) => ({
        ...prev,
        profile: { ...(prev?.profile ?? {}), fullName: form.fullName },
      }));
      setEditing(false);
      toast({ title: "Profile updated" });
      // Sync fullName back to Clerk so sidebar reflects it immediately
      if (user && form.fullName.trim()) {
        const parts = form.fullName.trim().split(" ");
        const firstName = parts[0] ?? "";
        const lastName = parts.slice(1).join(" ") ?? "";
        try {
          await user.update({ firstName, lastName });
        } catch {
          // Clerk sync failed — name is saved in DB, sidebar may need page refresh
        }
      }
    },
  });

  function openPwDialog() {
    setPwForm({ current: "", newPw: "", confirm: "", logoutAll: false });
    setPwError("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setShowPwDialog(true);
  }

  // Crop helpers
  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCropImageSrc(e.target?.result as string);
      setCropScale(1);
      setCropPosition({ x: 0, y: 0 });
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropMouseDown = useCallback((e: React.MouseEvent) => {
    if (!cropImageRef.current) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y });
  }, [cropPosition]);

  const handleCropMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !cropContainerRef.current || !cropImageRef.current) return;
    const container = cropContainerRef.current;
    const rect = container.getBoundingClientRect();
    const img = cropImageRef.current;
    const imgWidth = img.naturalWidth * cropScale;
    const imgHeight = img.naturalHeight * cropScale;
    const minX = rect.width - imgWidth;
    const minY = rect.height - imgHeight;
    let newX = e.clientX - dragStart.x;
    let newY = e.clientY - dragStart.y;
    newX = Math.max(minX, Math.min(0, newX));
    newY = Math.max(minY, Math.min(0, newY));
    setCropPosition({ x: newX, y: newY });
  }, [isDragging, dragStart, cropScale]);

  const handleCropMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleZoomIn = () => setCropScale((s) => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setCropScale((s) => Math.max(s - 0.2, 0.5));

  const handleCropSave = async () => {
    if (!cropImageSrc || !cropImageRef.current || !cropContainerRef.current) return;
    const img = cropImageRef.current;
    const container = cropContainerRef.current;
    const containerSize = Math.min(container.clientWidth, container.clientHeight);
    const scale = cropScale;
    const imgNaturalW = img.naturalWidth;
    const imgNaturalH = img.naturalHeight;
    const displayedW = imgNaturalW * scale;
    const displayedH = imgNaturalH * scale;
    const offsetX = -cropPosition.x;
    const offsetY = -cropPosition.y;
    const cropRatioX = offsetX / displayedW;
    const cropRatioY = offsetY / displayedH;
    const cropRatioSize = containerSize / displayedW;
    const cropX = Math.max(0, Math.round(cropRatioX * imgNaturalW));
    const cropY = Math.max(0, Math.round(cropRatioY * imgNaturalH));
    const cropSize = Math.round(cropRatioSize * imgNaturalW);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, 512, 512);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setShowCropDialog(false);
      setCropImageSrc(null);
      setAvatarUploading(true);
      try {
        const res = await fetch(`${basePath}/api/profile/avatar`, {
          method: "POST",
          credentials: "include",
          body: blob,
        });
        const result = await res.json();
        if (res.ok) {
          qc.invalidateQueries({ queryKey: ["user-profile"] });
      qc.invalidateQueries({ queryKey: ["user-profile-summary"] });
          toast({ title: "Profile picture updated" });
        } else {
          toast({ title: result.error || "Upload failed", variant: "destructive" });
        }
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
      } finally {
        setAvatarUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }, "image/jpeg", 0.9);
  };

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
    <div className="space-y-6 max-w-4xl w-full min-w-0">
      <div>
        <h1 className="page-title font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account details and subscription</p>
      </div>

      {/* Profile info */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div className="flex items-center gap-3 min-w-0 w-full">
            <div className="relative group cursor-pointer flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
              {avatarUploading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-black/50">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {data?.profile?.avatarUrl ? (
                <img src={data.profile.avatarUrl} alt={user?.fullName ?? "Avatar"} className="w-14 h-14 rounded-full object-cover ring-2 ring-orange-100" />
              ) : user?.imageUrl ? (
                <img src={user.imageUrl} alt={user.fullName ?? "Avatar"} className="w-14 h-14 rounded-full object-cover ring-2 ring-orange-100" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                  <User className="w-7 h-7 text-orange-500" />
                </div>
              )}
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  handleFileSelect(file);
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate">{form.fullName || resolveClerkName(user) || "Your Name"}</CardTitle>
              <p className="text-sm text-slate-400 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
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
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto sm:flex-shrink-0">
            <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-11 justify-center" onClick={openPwDialog}>
              <KeyRound className="w-4 h-4 mr-1.5 flex-shrink-0" />
              Change Password
            </Button>
            {editing ? (
              <>
                <Button variant="ghost" size="sm" className="w-full sm:w-auto min-h-11 justify-center" onClick={() => setEditing(false)}>
                  <X className="w-4 h-4 mr-1.5" />Cancel
                </Button>
                <Button size="sm" className="w-full sm:w-auto min-h-11 justify-center bg-orange-500 hover:bg-orange-600" onClick={() => updateMutation.mutate({ ...form, teamSize: form.teamSize ? Number(form.teamSize) : undefined })} disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-1.5" />{updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-11 justify-center" onClick={() => setEditing(true)}>
                <Edit2 className="w-4 h-4 mr-1.5" />Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

    {/* Crop Avatar Dialog */}
    <Dialog open={showCropDialog} onOpenChange={(open) => { if (!open) { setShowCropDialog(false); setCropImageSrc(null); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Crop Profile Picture
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Drag to position and use zoom to fit your face in the circle. The cropped area will be used for your profile avatar.
          </p>
          <div
            ref={cropContainerRef}
            className="relative w-80 h-80 mx-auto overflow-hidden rounded-lg border-2 border-orange-200 bg-slate-100 cursor-move"
            onMouseDown={handleCropMouseDown}
            onMouseMove={handleCropMouseMove}
            onMouseUp={handleCropMouseUp}
            onMouseLeave={handleCropMouseUp}
          >
            {/* Circular mask overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="absolute inset-0 bg-black/40" style={{ clipPath: "circle(40% at 50% 50%)" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[80%] h-[80%] rounded-full border-2 border-white border-dashed" />
              </div>
            </div>
            {cropImageSrc && (
              <img
                ref={cropImageRef}
                src={cropImageSrc}
                alt="Crop preview"
                className="absolute select-none"
                style={{
                  transform: `translate(${cropPosition.x}px, ${cropPosition.y}px) scale(${cropScale})`,
                  transformOrigin: "top left",
                  maxWidth: "none",
                  maxHeight: "none",
                }}
                draggable={false}
              />
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{Math.round(cropScale * 100)}%</span>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Move className="w-3 h-3" />
            Drag to position
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setShowCropDialog(false); setCropImageSrc(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
            Cancel
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleCropSave} disabled={avatarUploading}>
            {avatarUploading ? "Saving..." : "Crop & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
