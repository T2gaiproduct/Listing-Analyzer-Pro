import { Settings } from "lucide-react";
import { NotificationPreferencesCard } from "@/components/notification-preferences-card";
import { SettingsAppearanceCard } from "@/components/settings-appearance-card";
import { SettingsAccountCard } from "@/components/settings-account-card";
import { SettingsSecurityCard } from "@/components/settings-security-card";
import { SettingsIntegrationsCard } from "@/components/settings-integrations-card";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-orange-500" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage notifications, email alerts, appearance, account preferences, security, and integrations.
        </p>
      </div>

      <SettingsAccountCard />
      <NotificationPreferencesCard />
      <SettingsAppearanceCard />
      <SettingsSecurityCard />
      <SettingsIntegrationsCard />
    </div>
  );
}
