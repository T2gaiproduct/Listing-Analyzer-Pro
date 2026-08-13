import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Bell, Info, Mail } from "lucide-react";
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
  type NotificationPreferenceCategory,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import { settingsPanelClassName } from "@/components/settings-panel";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? "Sign in again to manage notification preferences."
          : `Server error (${res.status}). Restart the API server after pulling the latest code.`,
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

async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await fetch(`${basePath}/api/profile/notification-preferences`, { credentials: "include" });
  const data = await readApiJson<{ preferences?: NotificationPreferences }>(res);
  return mergeNotificationPreferences(data.preferences);
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
  return mergeNotificationPreferences(data.preferences);
}

function applyNotificationPreferencesPatch(
  current: NotificationPreferences,
  patch: Partial<NotificationPreferences>,
): NotificationPreferences {
  return mergeNotificationPreferences({
    ...current,
    ...patch,
    email: patch.email
      ? { ...current.email, ...patch.email }
      : current.email,
  });
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
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["notification-preferences"] });
      const previous = qc.getQueryData<NotificationPreferences>(["notification-preferences"]);
      if (previous) {
        qc.setQueryData(
          ["notification-preferences"],
          applyNotificationPreferencesPatch(previous, patch),
        );
      }
      return { previous };
    },
    onSuccess: (updated) => {
      qc.setQueryData(["notification-preferences"], updated);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Notification preferences updated" });
    },
    onError: (err: Error, _patch, context) => {
      if (context?.previous) {
        qc.setQueryData(["notification-preferences"], context.previous);
      }
      toast({ title: "Could not update preferences", description: err.message, variant: "destructive" });
    },
  });

  const onToggleApp = (category: NotificationPreferenceCategory, enabled: boolean) => {
    if (prefsUnavailable) {
      toast({
        title: "Preferences not available",
        description: error instanceof Error ? error.message : "Restart the API server and try again.",
        variant: "destructive",
      });
      return;
    }
    save.mutate({ [category]: enabled });
  };

  const onToggleEmail = (category: NotificationPreferenceCategory, enabled: boolean) => {
    if (prefsUnavailable) {
      toast({
        title: "Preferences not available",
        description: error instanceof Error ? error.message : "Restart the API server and try again.",
        variant: "destructive",
      });
      return;
    }
    save.mutate({
      email: {
        ...(resolvedPreferences.email ?? DEFAULT_NOTIFICATION_PREFERENCES.email!),
        [category]: enabled,
      },
    });
  };

  const categories = showAdminAlerts
    ? NOTIFICATION_PREFERENCE_CATEGORIES
    : CUSTOMER_NOTIFICATION_PREFERENCE_CATEGORIES;

  return (
    <Card className={compact ? "border-border" : undefined}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4 text-orange-500" />
          Notifications & email
        </CardTitle>
        <CardDescription>
          Control in-app alerts and email delivery separately for each category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
          </div>
        ) : prefsUnavailable ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Could not load notification preferences</p>
                <p className="text-xs mt-1 opacity-90">
                  {error instanceof Error ? error.message : "Restart the API server after pulling the latest code."}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-medium underline hover:no-underline"
              onClick={() => void refetch()}
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {categories.map((category) => {
              const meta = NOTIFICATION_PREFERENCE_META[category];
              const emailEnabled = resolvedPreferences.email![category];
              return (
                <div
                  key={category}
                  className={settingsPanelClassName("grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-4 items-start")}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
                    <p className="text-[11px] text-muted-foreground/80">e.g. {meta.examples}</p>
                  </div>
                  <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-1.5 sm:pt-1">
                    <Label
                      htmlFor={`notif-app-${category}`}
                      className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      In-app
                    </Label>
                    <Switch
                      id={`notif-app-${category}`}
                      checked={resolvedPreferences[category]}
                      disabled={save.isPending}
                      onCheckedChange={(checked) => onToggleApp(category, checked)}
                    />
                  </div>
                  <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-1.5 sm:pt-1">
                    <Label
                      htmlFor={`notif-email-${category}`}
                      className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" />
                      Email
                    </Label>
                    <Switch
                      id={`notif-email-${category}`}
                      checked={emailEnabled}
                      disabled={save.isPending}
                      onCheckedChange={(checked) => onToggleEmail(category, checked)}
                    />
                  </div>
                </div>
              );
            })}

            <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-xs text-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                System announcements and account-critical messages are always delivered in-app and cannot be turned off.
                Email for those messages still follows your SMTP configuration in Admin.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
