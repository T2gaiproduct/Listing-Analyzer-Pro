import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Info } from "lucide-react";
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

async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await fetch(`${basePath}/api/profile/notification-preferences`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load notification preferences");
  const data = (await res.json()) as { preferences?: NotificationPreferences };
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
  const data = (await res.json()) as { preferences?: NotificationPreferences; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to update notification preferences");
  return data.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
}

export function NotificationPreferencesCard({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: preferences = DEFAULT_NOTIFICATION_PREFERENCES, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: fetchNotificationPreferences,
  });

  const save = useMutation({
    mutationFn: saveNotificationPreferences,
    onSuccess: (updated) => {
      qc.setQueryData(["notification-preferences"], updated);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Notification preferences updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not update preferences", description: error.message, variant: "destructive" });
    },
  });

  const onToggle = (category: keyof NotificationPreferences, enabled: boolean) => {
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
                    checked={preferences[category]}
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
