import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle, Mail, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-fetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface WorkspaceInviteDetails {
  id: number;
  invitedEmail: string;
  invitedName: string;
  status: string;
  invitedAt: string;
  workspaceId: number;
  workspaceName: string;
  roleName: string;
}

export default function AcceptWorkspaceInvite() {
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<WorkspaceInviteDetails | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  useEffect(() => {
    if (!token) return;
    setInviteLoading(true);
    fetchJson<WorkspaceInviteDetails>(`${basePath}/api/workspace-invite/${encodeURIComponent(token)}`)
      .then((data) => setInvite(data))
      .catch((e: Error) => setInviteError(e.message))
      .finally(() => setInviteLoading(false));
  }, [token]);

  const signedInEmail = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? "";
  const inviteEmail = invite?.invitedEmail?.trim().toLowerCase() ?? "";
  const emailMismatch = Boolean(
    user && invite && signedInEmail && inviteEmail && signedInEmail !== inviteEmail,
  );

  const acceptMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ workspaceId: number; workspaceName: string }>(
        `${basePath}/api/workspace-invite/${encodeURIComponent(token!)}/accept`,
        { method: "POST" },
      ),
    onSuccess: async (data) => {
      setAccepted(true);
      toast({
        title: "Welcome to the workspace!",
        description: `You now have access to ${data.workspaceName}.`,
      });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["workspaces"] }),
        queryClient.refetchQueries({ queryKey: ["user-profile-summary"] }),
      ]);
      setTimeout(() => setLocation("/dashboard", { replace: true }), 800);
    },
    onError: (e: Error) =>
      toast({ title: "Failed to accept invite", description: e.message, variant: "destructive" }),
  });

  const acceptPath = `${basePath}/accept-workspace-invite?token=${token}`;

  if (!token || inviteError) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invite Not Found</h1>
          <p className="text-slate-500 text-sm mb-5">
            {inviteError ?? "This invite link is invalid or has expired. Ask your workspace admin to send a new invite."}
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
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-orange-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">You're in!</h1>
          <p className="text-slate-500 text-sm">Welcome to the workspace. Redirecting to your dashboard…</p>
          <div className="mt-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-orange-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Workspace invitation</h1>
            <p className="text-slate-500 text-sm mt-1">
              You've been invited to join a workspace on SellerLens.
            </p>
          </div>

          {invite && (
            <div className="bg-slate-50 rounded-xl p-5 space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{invite.workspaceName}</p>
                  <p className="text-xs text-slate-500">Workspace</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-600">Invited as:</span>
                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs capitalize">
                  {invite.roleName}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {invite.invitedName} · {invite.invitedEmail}
              </p>
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
              {emailMismatch && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  This invite was sent to <strong>{invite?.invitedEmail}</strong>. Sign out and sign in with that email, or ask the workspace admin to invite <strong>{user.primaryEmailAddress?.emailAddress}</strong>.
                </div>
              )}
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending || emailMismatch}
              >
                {acceptMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Joining…</>
                ) : (
                  <>Accept & join workspace <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
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
                  const qs = new URLSearchParams({
                    redirect_url: acceptPath,
                    email: invite?.invitedEmail ?? "",
                  });
                  setLocation(`/sign-up?${qs.toString()}`);
                }}
              >
                Create account & join
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const qs = new URLSearchParams({
                    redirect_url: acceptPath,
                    email: invite?.invitedEmail ?? "",
                  });
                  setLocation(`/sign-in?${qs.toString()}`);
                }}
              >
                Sign in to accept
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
