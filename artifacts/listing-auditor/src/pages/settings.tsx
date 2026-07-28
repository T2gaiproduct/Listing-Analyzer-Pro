import { Settings } from "lucide-react";
import { NotificationPreferencesCard } from "@/components/notification-preferences-card";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-orange-500" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage how SellerLens contacts you and keep your account preferences up to date.
        </p>
      </div>

      <NotificationPreferencesCard />

      <p className="text-xs text-muted-foreground">
        More settings — account, appearance, security, and integrations — are coming soon.
      </p>
    </div>
  );
}
