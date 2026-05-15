import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Ban, CheckCircle, Trash2, Eye, Users, PauseCircle, PlayCircle, AlertTriangle, KeyRound, Copy, Check, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Customer {
  id: string;
  profileId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string;
  banned: boolean;
  locked: boolean;
  createdAt: number;
  lastSignInAt: number | null;
  auditCount: number;
}

type ActionType = "view" | "suspend" | "unsuspend" | "ban" | "unban" | "delete";

interface PendingAction {
  type: ActionType;
  customer: Customer;
}

function customerId(profileId: number | null): string {
  if (!profileId) return "—";
  return `CUST-${String(profileId).padStart(5, "0")}`;
}

function customerName(c: Customer): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
}

function actionConfig(type: ActionType): {
  title: string;
  desc1: string;
  desc2: string;
  btn1: string;
  btn2: string;
  destructive: boolean;
} {
  const configs: Record<ActionType, ReturnType<typeof actionConfig>> = {
    view: {
      title: "View Customer",
      desc1: "You are about to open this customer's full account details, audit history, and billing information.",
      desc2: "Confirm you want to access this customer's private account data.",
      btn1: "Continue",
      btn2: "Yes, View Account",
      destructive: false,
    },
    suspend: {
      title: "Suspend Account",
      desc1: "This will temporarily lock the customer's account. They will not be able to sign in until you unsuspend them.",
      desc2: "Are you absolutely sure? The customer will lose access immediately.",
      btn1: "Yes, Suspend",
      btn2: "Confirm Suspension",
      destructive: true,
    },
    unsuspend: {
      title: "Unsuspend Account",
      desc1: "This will restore the customer's access and allow them to sign in again.",
      desc2: "Confirm you want to restore access for this account.",
      btn1: "Yes, Restore",
      btn2: "Confirm Restore",
      destructive: false,
    },
    ban: {
      title: "Ban Account",
      desc1: "This will permanently ban the customer from the platform. Their account will be blocked from signing in.",
      desc2: "This is a serious action. Are you absolutely certain you want to ban this account?",
      btn1: "Yes, Ban",
      btn2: "Confirm Ban",
      destructive: true,
    },
    unban: {
      title: "Remove Ban",
      desc1: "This will remove the ban on this customer's account and allow them to sign in again.",
      desc2: "Confirm you want to lift the ban on this account.",
      btn1: "Yes, Unban",
      btn2: "Confirm Unban",
      destructive: false,
    },
    delete: {
      title: "Delete Customer",
      desc1: "This will permanently delete the customer's account and all associated data including audits, credits, and billing history.",
      desc2: "This action is irreversible. All data will be lost forever. Are you absolutely sure?",
      btn1: "Yes, Delete",
      btn2: "Permanently Delete",
      destructive: true,
    },
  };
  return configs[type];
}

function fetchCustomers(q: string): Promise<{ customers: Customer[]; total: number }> {
  return fetch(`${basePath}/api/admin/customers?limit=50&query=${encodeURIComponent(q)}`, { credentials: "include" }).then((r) => r.json());
}

export default function AdminCustomers() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmStep, setConfirmStep] = useState(1);
  const [resetPassResult, setResetPassResult] = useState<{ customer: Customer; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers", query],
    queryFn: () => fetchCustomers(query),
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, ban }: { userId: string; ban: boolean }) =>
      fetch(`${basePath}/api/admin/customers/${userId}/${ban ? "ban" : "unban"}`, { method: "PATCH", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customers"] }); toast({ title: "Customer status updated" }); },
  });

  const lockMutation = useMutation({
    mutationFn: ({ userId, lock }: { userId: string; lock: boolean }) =>
      fetch(`${basePath}/api/admin/customers/${userId}/${lock ? "lock" : "unlock"}`, { method: "PATCH", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customers"] }); toast({ title: "Suspension status updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(`${basePath}/api/admin/customers/${userId}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customers"] }); toast({ title: "Customer deleted" }); },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(`${basePath}/api/admin/customers/${userId}/reset-password`, { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: (data, userId) => {
      const customer = resetPassResult?.customer ?? pendingAction?.customer ?? data?.customers?.find((c: Customer) => c.id === userId);
      setResetPassResult({ customer: customer!, password: data.newPassword });
    },
    onError: () => toast({ title: "Failed to reset password", variant: "destructive" }),
  });

  function openAction(type: ActionType, customer: Customer) {
    setPendingAction({ type, customer });
    setConfirmStep(1);
  }

  function closeDialog() {
    setPendingAction(null);
    setConfirmStep(1);
  }

  function handleStep2Confirm() {
    if (!pendingAction) return;
    const { type, customer } = pendingAction;
    closeDialog();
    if (type === "view") setLocation(`/admin/customers/${customer.id}`);
    else if (type === "suspend") lockMutation.mutate({ userId: customer.id, lock: true });
    else if (type === "unsuspend") lockMutation.mutate({ userId: customer.id, lock: false });
    else if (type === "ban") banMutation.mutate({ userId: customer.id, ban: true });
    else if (type === "unban") banMutation.mutate({ userId: customer.id, ban: false });
    else if (type === "delete") deleteMutation.mutate(customer.id);
  }

  function handleResetPassword(customer: Customer) {
    setResetPassResult({ customer, password: "" });
    resetPasswordMutation.mutate(customer.id);
  }

  function handleCopy(password: string) {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const cfg = pendingAction ? actionConfig(pendingAction.type) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data ? `${data.total} total users` : "Manage all platform users"}
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setQuery(search)}
              />
            </div>
            <Button onClick={() => setQuery(search)} variant="secondary">Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Customer ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Audits</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Joined</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Active</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4"><div className="h-10 w-48 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-8 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-20 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-20 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-5 w-14 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-8 w-32 bg-slate-100 rounded animate-pulse ml-auto" /></td>
                </tr>
              ))}
            {!isLoading && data?.customers.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-600 text-xs font-bold">
                          {(c.firstName?.[0] ?? c.email[0] ?? "?").toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-slate-800">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</p>
                      <p className="text-xs text-slate-400">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                    {customerId(c.profileId)}
                  </span>
                </td>
                <td className="px-4 py-4 font-semibold text-slate-700">{c.auditCount}</td>
                <td className="px-4 py-4 text-slate-400 text-xs">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-4 text-slate-400 text-xs">
                  {c.lastSignInAt ? formatDistanceToNow(new Date(c.lastSignInAt), { addSuffix: true }) : "Never"}
                </td>
                <td className="px-4 py-4">
                  {c.banned ? (
                    <Badge variant="destructive" className="text-xs">Banned</Badge>
                  ) : c.locked ? (
                    <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs">Locked</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Active</Badge>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500 hover:text-slate-900" title="View detail" onClick={() => openAction("view", c)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500 hover:text-blue-600" title="Reset password" onClick={() => handleResetPassword(c)}>
                      <KeyRound className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500 hover:text-yellow-600" title={c.locked ? "Activate (unsuspend)" : "Suspend account"} onClick={() => openAction(c.locked ? "unsuspend" : "suspend", c)} disabled={c.banned}>
                      {c.locked ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500 hover:text-amber-600" title={c.banned ? "Unban" : "Ban"} onClick={() => openAction(c.banned ? "unban" : "ban", c)}>
                      {c.banned ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-500 hover:text-red-600" title="Delete customer" onClick={() => openAction("delete", c)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.customers.length && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400">No customers found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Double Confirmation Dialog */}
      {pendingAction && cfg && (
        <Dialog open onOpenChange={closeDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2 ${confirmStep === 2 && cfg.destructive ? "bg-red-50" : "bg-amber-50"}`}>
                <AlertTriangle className={`w-7 h-7 ${confirmStep === 2 && cfg.destructive ? "text-red-500" : "text-amber-500"}`} />
              </div>
              <DialogTitle>{confirmStep === 1 ? cfg.title : "Final Confirmation"}</DialogTitle>
              <DialogDescription className="text-center pt-1">
                {confirmStep === 1 ? (
                  <><span className="font-semibold text-slate-700">{customerName(pendingAction.customer)}</span><br />{cfg.desc1}</>
                ) : (
                  <><span className={`font-semibold ${cfg.destructive ? "text-red-600" : "text-slate-700"}`}>{customerName(pendingAction.customer)}</span><br />{cfg.desc2}</>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              {confirmStep === 1 ? (
                <>
                  <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
                  <Button
                    className={`flex-1 ${cfg.destructive ? "bg-amber-500 hover:bg-amber-600" : "bg-orange-500 hover:bg-orange-600"}`}
                    onClick={() => setConfirmStep(2)}
                  >
                    {cfg.btn1}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmStep(1)}>Go Back</Button>
                  <Button
                    className={`flex-1 ${cfg.destructive ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"}`}
                    onClick={handleStep2Confirm}
                  >
                    {cfg.btn2}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reset Password Result Dialog */}
      {resetPassResult !== null && (
        <Dialog open onOpenChange={() => { setResetPassResult(null); setCopied(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-7 h-7 text-blue-500" />
              </div>
              <DialogTitle>Password Reset</DialogTitle>
              <DialogDescription className="text-center pt-1">
                {resetPasswordMutation.isPending
                  ? "Generating a new secure password..."
                  : <>A new password has been generated for <span className="font-semibold text-slate-700">{customerName(resetPassResult.customer)}</span>. Share this with the customer securely — it will not be shown again.</>
                }
              </DialogDescription>
            </DialogHeader>
            {resetPasswordMutation.isPending ? (
              <div className="flex justify-center py-4">
                <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : resetPassResult.password ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3 my-2">
                <span className="font-mono text-sm font-semibold text-slate-800 tracking-wider break-all">{resetPassResult.password}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex-shrink-0 h-8 px-2 ${copied ? "text-green-600" : "text-slate-500 hover:text-slate-900"}`}
                  onClick={() => handleCopy(resetPassResult.password)}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            ) : null}
            <DialogFooter>
              <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => { setResetPassResult(null); setCopied(false); }}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
