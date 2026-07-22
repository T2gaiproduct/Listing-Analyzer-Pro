import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Mail, Shield, User, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface InviteDetails {
  id: number;
  invitedEmail: string;
  invitedName: string;
  role: string;
  status: string;
  invitedAt: string;
}

const roleDescriptions: Record<string, string> = {
  admin: "Full workspace access — can create and edit audits",
  editor: "Can create and edit audits in the shared workspace",
  viewer: "Read-only access to audits and reports",
};

const roleColors: Record<string, string> = {
  admin: "bg-orange-100 text-orange-700",
  editor: "bg-blue-100 text-blue-700",
  viewer: "bg-slate-100 text-slate-600",
};

export default function AcceptInvite() {
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  // Extract token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  // Fetch invite details
  useEffect(() => {
    if (!token) return;
    setInviteLoading(true);
    fetch(`${basePath}/api/invite/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Invite not found");
        setInvite(data);
      })
      .catch((e) => setInviteError(e.message))
      .finally(() => setInviteLoading(false));
  }, [token]);

  const acceptMutation = useMutation({
    mutationFn: () =>
      fetch(`${basePath}/api/invite/${token}/accept`, {
        method: "POST",
        credentials: "include",
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to accept invite");
        return data;
      }),
    onSuccess: async () => {
      setAccepted(true);
      toast({ title: "Welcome to the team!", description: "You now have access to your team workspace." });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["user-profile-summary"] }),
        queryClient.refetchQueries({ queryKey: ["team-membership"] }),
        queryClient.refetchQueries({ queryKey: ["team-membership-credits"] }),
      ]);
      setTimeout(() => setLocation("/dashboard", { replace: true }), 800);
    },
    onError: (e: Error) => toast({ title: "Failed to accept invite", description: e.message, variant: "destructive" }),
  });

  if (!token || inviteError) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invite Not Found</h1>
          <p className="text-slate-500 text-sm mb-5">
            {inviteError ?? "This invite link is invalid or has expired. Ask your team owner to send a new invite."}
          </p>
          <Button onClick={() => setLocation("/")} className="bg-orange-500 hover:bg-orange-600">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (inviteLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">You're in!</h1>
          <p className="text-slate-500 text-sm">Welcome to the team. Redirecting to your dashboard…</p>
          <div className="mt-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        {/* Invite card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-orange-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">You've been invited</h1>
            <p className="text-slate-500 text-sm mt-1">
              You've been invited to join a workspace as a team member.
            </p>
          </div>

          {invite && (
            <div className="bg-slate-50 rounded-xl p-5 space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-orange-600">{invite.invitedName[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{invite.invitedName}</p>
                  <p className="text-xs text-slate-500">{invite.invitedEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-1.5">
                  {invite.role === "admin" ? <Shield className="w-3.5 h-3.5 text-orange-500" /> : <User className="w-3.5 h-3.5 text-blue-500" />}
                  <span className="text-xs text-slate-600">Access level:</span>
                </div>
                <Badge className={`${roleColors[invite.role] ?? "bg-slate-100 text-slate-600"} hover:bg-inherit text-xs`}>{invite.role}</Badge>
              </div>
              <p className="text-xs text-slate-400">{roleDescriptions[invite.role] ?? ""}</p>
            </div>
          )}

          {!isLoaded ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : user ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 text-center">
                Signed in as <strong>{user.primaryEmailAddress?.emailAddress}</strong>
              </p>
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Joining…</>
                ) : (
                  <>Accept & Join Workspace <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-slate-500"
                onClick={() => setLocation("/")}>
                Not you? Go to sign in
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 text-center mb-4">
                Sign in or create an account to accept this invite.
              </p>
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                onClick={() => {
                  localStorage.setItem("pendingInviteToken", token);
                  setLocation(`/sign-up?redirect_url=${encodeURIComponent(`${basePath}/accept-invite?token=${token}`)}`);
                }}
              >
                Create Account & Join
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  localStorage.setItem("pendingInviteToken", token);
                  setLocation(`/sign-in?redirect_url=${encodeURIComponent(`${basePath}/accept-invite?token=${token}`)}`);
                }}
              >
                Sign In to Accept
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          SellerLens — AI-powered Amazon listing optimization
        </p>
      </div>
    </div>
  );
}
