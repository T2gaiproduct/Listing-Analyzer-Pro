import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Mail, AlertTriangle, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteLogoImage } from "@/components/site-logo";
import { getDefaultAdminRoute } from "@workspace/admin-permissions";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AdminInviteDetails {
  email: string;
  role: string;
  permissions: string[];
  invitedAt: string;
}

export default function AcceptAdminInvite() {
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get("token"),
    [],
  );
  const [invite, setInvite] = useState<AdminInviteDetails | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteError("Invalid invite link");
      setInviteLoading(false);
      return;
    }

    let cancelled = false;
    setInviteError(null);
    setInviteLoading(true);

    fetch(`${basePath}/api/admin-role-invite/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const text = await r.text();
        let data: AdminInviteDetails & { error?: string };
        try {
          data = JSON.parse(text) as AdminInviteDetails & { error?: string };
        } catch {
          throw new Error(r.ok ? "Invalid server response" : `Invite lookup failed (${r.status})`);
        }
        if (!r.ok) throw new Error(data.error ?? "Invite not found");
        if (!cancelled) setInvite(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setInviteError(e.message);
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });

    return () => { cancelled = true; };
  }, [token]);

  const acceptMutation = useMutation({
    mutationFn: () =>
      fetch(`${basePath}/api/admin-role-invite/${encodeURIComponent(token ?? "")}/accept`, {
        method: "POST",
        credentials: "include",
      }).then(async (r) => {
        const text = await r.text();
        let data: { error?: string; permissions?: string[]; role?: string };
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          throw new Error(r.ok ? "Invalid server response" : `Accept failed (${r.status})`);
        }
        if (!r.ok) throw new Error(data.error ?? "Failed to accept invite");
        return data;
      }),
    onSuccess: (data) => {
      setAccepted(true);
      void queryClient.invalidateQueries({ queryKey: ["is-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-me"] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile-summary"] });
      const route = getDefaultAdminRoute(data.permissions ?? [], { roleName: data.role });
      setTimeout(() => setLocation(route, { replace: true }), 800);
    },
    onError: (e: Error) => setInviteError(e.message),
  });

  useEffect(() => {
    if (!isLoaded || !user || !token || accepted || acceptMutation.isPending || acceptMutation.isSuccess) return;
    if (invite) {
      acceptMutation.mutate();
      return;
    }
    if (!inviteLoading && inviteError) {
      fetch(`${basePath}/api/admin/is-admin`, { credentials: "include" })
        .then((r) => r.json() as Promise<{ isAdmin?: boolean }>)
        .then((data) => {
          if (data.isAdmin) setLocation("/admin", { replace: true });
        })
        .catch(() => { /* ignore */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-accept once when signed in with a valid invite
  }, [isLoaded, user, invite, inviteLoading, inviteError, token, accepted]);

  const authRedirect = token
    ? encodeURIComponent(`${basePath}/accept-admin-invite?token=${token}`)
    : encodeURIComponent("/admin");

  if (inviteLoading || (user && acceptMutation.isPending)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border p-8 text-center space-y-4">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Admin access granted</h1>
          <p className="text-sm text-slate-500">Redirecting to your admin dashboard…</p>
        </div>
      </div>
    );
  }

  if (inviteError || !invite) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Invite unavailable</h1>
          <p className="text-sm text-slate-500">{inviteError ?? "This invite link is invalid or has already been used."}</p>
          <Button onClick={() => setLocation("/")} variant="outline">Go to homepage</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-10">
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-8 pt-8 pb-5 text-center border-b border-slate-100">
          <SiteLogoImage className="h-8 w-auto mx-auto mb-5" />
          <h1 className="text-2xl font-bold text-slate-900">Admin invitation</h1>
          <p className="text-slate-500 text-sm mt-1">You've been invited to SellerLens admin</p>
        </div>

        <div className="px-8 py-6 space-y-5">
          <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-slate-800">Role: {invite.role}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>{invite.email}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {invite.permissions.slice(0, 4).map((p) => (
                <Badge key={p} variant="secondary" className="text-xs">{p.replace(/_/g, " ")}</Badge>
              ))}
              {invite.permissions.length > 4 && (
                <Badge variant="outline" className="text-xs">+{invite.permissions.length - 4}</Badge>
              )}
            </div>
          </div>

          <p className="text-sm text-slate-600 text-center">
            Create an account or sign in with <strong>{invite.email}</strong> to access admin.
          </p>

          <div className="space-y-2">
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => setLocation(`/sign-up?redirect_url=${authRedirect}&email=${encodeURIComponent(invite.email)}`)}
            >
              Create account <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation(`/sign-in?redirect_url=${authRedirect}`)}
            >
              I already have an account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
