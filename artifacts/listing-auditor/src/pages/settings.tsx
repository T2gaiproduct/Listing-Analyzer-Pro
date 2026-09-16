import { useEffect, useState } from "react";
import { Settings, LifeBuoy } from "lucide-react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationPreferencesCard } from "@/components/notification-preferences-card";
import { SettingsAppearanceCard } from "@/components/settings-appearance-card";
import { SettingsAccountCard } from "@/components/settings-account-card";
import { SettingsSecurityCard } from "@/components/settings-security-card";
import { SettingsIntegrationsCard } from "@/components/settings-integrations-card";
import { SupportTicketForm } from "@/components/support-ticket-form";

export default function SettingsPage() {
  const [location] = useLocation();
  const [tab, setTab] = useState<"general" | "support">("general");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "support") {
      setTab("support");
    }
  }, [location]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-orange-500" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage notifications, appearance, account preferences, security, integrations, and support.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "general" | "support")}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="support" className="gap-1.5">
            <LifeBuoy className="w-3.5 h-3.5" />
            Support ticket
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="space-y-6 mt-6">
          <SettingsAccountCard />
          <NotificationPreferencesCard />
          <SettingsAppearanceCard />
          <SettingsSecurityCard />
          <SettingsIntegrationsCard />
        </TabsContent>
        <TabsContent value="support" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Submit a ticket to our support team. We reply to the email on your SellerLens account.
          </p>
          <SupportTicketForm compact />
        </TabsContent>
      </Tabs>
    </div>
  );
}
