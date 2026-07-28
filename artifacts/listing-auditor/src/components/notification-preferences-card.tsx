import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Bell, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES,
  NOTIFICATION_PREFERENCE_CATEGORIES,
  NOTIFICATION_PREFERENCE_META,
  mergeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? "Sign in again to manage notification preferences."
          : `Server error (${res.status}). Restart the API server after deploying the latest code.`,
      );
    }
    return {} as T;
  }

  if (text.trimStart().startsWith("<")) {
    throw new Error(
      "The API server is running old code or is not reachable. Run: bash scripts/dev-stack.sh (or restart the API after git pull).",
    );
  }

  try {
    const data = JSON.parse(text) as T & { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? `Server error (${res.status})`);
    }
    return data;
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith("Server error")) {
      throw error;
    }
    throw new Error("Invalid response from server. Restart the API and run pnpm --filter @workspace/db run push.");
  }
}

function resolvePreferencesPayload(data: {
  preferences?: Partial<NotificationPreferences>;
  notificationPreferences?: Partial<NotificationPreferences>;
  profile?: { notificationPreferences?: Partial<NotificationPreferences> } | null;
}): NotificationPreferences {
  const raw =
    data.preferences
    ?? data.notificationPreferences
    ?? data.profile?.notificationPreferences;
  return mergeNotificationPreferences(raw);
}

async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const dedicated = await fetch(`${basePath}/api/profile/notification-preferences`, {
    credentials: "include",
  });
  if (dedicated.ok) {
    const data = await readApiJson<{ preferences?: Partial<NotificationPreferences> }>(dedicated);
    return resolvePreferencesPayload(data);
  }

  const res = await fetch(`${basePath}/api/profile`, { credentials: "include" });
  const data = await readApiJson<{
    notificationPreferences?: Partial<NotificationPreferences>;
    profile?: { notificationPreferences?: Partial<NotificationPreferences> } | null;
  }>(res);
  return resolvePreferencesPayload(data);
}

async function saveNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const res = await fetch(`${basePath}/api/profile/notification-preferences`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });

  if (res.ok) {
    const data = await readApiJson<{ preferences?: Partial<NotificationPreferences> }>(res);
    return resolvePreferencesPayload(data);
  }

  // Fallback for older API builds
  const legacy = await fetch(`${basePath}/api/profile`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationPreferences: preferences }),
  });
  const legacyData = await readApiJson<{
    notificationPreferences?: Partial<NotificationPreferences>;
  }>(legacy);
  return resolvePreferencesPayload(legacyData);
}

export function NotificationPreferencesCard({
  compact = false,
  showAdminAlerts = false,
}: {
  compact?: boolean;
  /** When true (admin dashboard), include Admin & platform alerts toggle. */
  showAdminAlerts?: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: preferences, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: fetchNotificationPreferences,
    retry: 1,
  });

  const resolvedPreferences = preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
  const prefsUnavailable = isError || !preferences;

  const save = useMutation({
    mutationFn: saveNotificationPreferences,
    onSuccess: (updated) => {
      qc.setQueryData(["notification-preferences"], updated);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Notification preferences updated" });
    },
    onError: (err: Error) => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast({ title: "Could not update preferences", description: err.message, variant: "destructive" });
    },
  });

  const onToggle = (category: keyof NotificationPreferences, enabled: boolean) => {
    if (prefsUnavailable) {
      toast({
        title: "Preferences not available",
        description: error instanceof Error ? error.message : "Restart the API server and try again.",
        variant: "destructive",
      });
      return;
    }

    const next = mergeNotificationPreferences({ ...resolvedPreferences, [category]: enabled });
    qc.setQueryData(["notification-preferences"], next);
    save.mutate(next);
  };

  const categories = showAdminAlerts
    ? NOTIFICATION_PREFERENCE_CATEGORIES
    : CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES;

  return (
    <Card className={compact ? "border-slate-200" : undefined}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4 text-orange-500" />
          Notification preferences
        </CardTitle>
        <CardDescription>
          Choose which types of alerts you receive in the app, live toast notifications, and email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
          </div>
        ) : prefsUnavailable ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Could not load notification preferences</p>
                <p className="text-xs mt-1 text-red-700/90">
                  {error instanceof Error ? error.message : "Restart the API server after pulling the latest code."}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-red-800 underline hover:no-underline"
              onClick={() => void refetch()}
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {categories.map((category) => {
              const meta = NOTIFICATION_PREFERENCE_META[category];
              return (
                <div
                  key={category}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor={`notif-pref-${category}`} className="text-sm font-semibold text-slate-900">
                      {meta.label}
                    </Label>
                    <p className="text-xs text-slate-500 leading-relaxed">{meta.description}</p>
                    <p className="text-[11px] text-slate-400">e.g. {meta.examples}</p>
                  </div>
                  <Switch
                    id={`notif-pref-${category}`}
                    checked={resolvedPreferences[category]}
                    disabled={save.isPending}
                    onCheckedChange={(checked) => onToggle(category, checked)}
                    className="mt-1 shrink-0"
                  />
                </div>
              );
            })}

            <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2.5 text-xs text-blue-800">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                System announcements and account-critical messages are always delivered and cannot be turned off.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
