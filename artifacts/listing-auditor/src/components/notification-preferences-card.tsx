import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Bell, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_CATEGORIES,
  NOTIFICATION_PREFERENCE_META,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? "Notification preferences API is not available yet. Deploy the latest backend and run database migrations, then restart the API server."
          : `Server error (${res.status}). The API may be offline or needs updating.`,
      );
    }
    return {} as T;
  }

  if (text.trimStart().startsWith("<")) {
    throw new Error(
      "The server returned HTML instead of JSON. Restart the API server with the latest code and ensure /api routes are proxied correctly.",
    );
  }

  try {
    const data = JSON.parse(text) as T & { error?: string };
    if (!res.ok) {
      throw new Error(
        data.error
          ?? (res.status === 404
            ? "Notification preferences API is not available yet. Deploy the latest backend and run database migrations."
            : `Server error (${res.status})`),
      );
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.message !== "Unexpected token") {
      throw error;
    }
    throw new Error("Invalid response from server. Deploy the latest API and run pnpm --filter @workspace/db run push.");
  }
}

async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await fetch(`${basePath}/api/profile/notification-preferences`, { credentials: "include" });
  const data = await readApiJson<{ preferences?: NotificationPreferences }>(res);
  return data.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
}

async function saveNotificationPreferences(
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const res = await fetch(`${basePath}/api/profile/notification-preferences`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await readApiJson<{ preferences?: NotificationPreferences }>(res);
  return data.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
}

export function NotificationPreferencesCard({ compact = false }: { compact?: boolean }) {
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
      toast({ title: "Could not update preferences", description: err.message, variant: "destructive" });
    },
  });

  const onToggle = (category: keyof NotificationPreferences, enabled: boolean) => {
    if (prefsUnavailable) {
      toast({
        title: "Preferences not available",
        description: error instanceof Error ? error.message : "Reload after deploying the latest API.",
        variant: "destructive",
      });
      return;
    }
    save.mutate({ [category]: enabled });
  };

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
                  {error instanceof Error ? error.message : "The API may need an update or database migration."}
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
            {NOTIFICATION_PREFERENCE_CATEGORIES.map((category) => {
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
