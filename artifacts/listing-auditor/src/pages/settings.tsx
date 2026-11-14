import { useCallback, useEffect, useState } from "react";
import { Settings, LifeBuoy, Store } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationPreferencesCard } from "@/components/notification-preferences-card";
import { SettingsAppearanceCard } from "@/components/settings-appearance-card";
import { SettingsAccountCard } from "@/components/settings-account-card";
import { SettingsSecurityCard } from "@/components/settings-security-card";
import { SettingsIntegrationsCard } from "@/components/settings-integrations-card";
import { SupportTicketForm } from "@/components/support-ticket-form";
import { SupportTicketInbox } from "@/components/support-ticket-inbox";
import MarketplacesPage from "@/pages/marketplaces";
import { cn } from "@/lib/utils";
import { SETTINGS_TAB_MARKETPLACES } from "@/lib/settings-nav";

type SettingsTab = "general" | typeof SETTINGS_TAB_MARKETPLACES | "support";

function parseSettingsTab(search: string): SettingsTab {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (tab === "support") return "support";
  if (tab === SETTINGS_TAB_MARKETPLACES) return SETTINGS_TAB_MARKETPLACES;
  return "general";
}

function settingsPathForTab(tab: SettingsTab): string {
  if (tab === "general") return "/settings";
  return `/settings?tab=${tab}`;
}

export default function SettingsPage() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const [tab, setTab] = useState<SettingsTab>(() => parseSettingsTab(search));

  useEffect(() => {
    setTab(parseSettingsTab(search));
  }, [location, search]);

  const onTabChange = useCallback(
    (value: string) => {
      const next = value as SettingsTab;
      setTab(next);
      setLocation(settingsPathForTab(next));
    },
    [setLocation],
  );

  return (
    <div className={cn("space-y-6", tab === SETTINGS_TAB_MARKETPLACES ? "max-w-6xl" : "max-w-3xl")}>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-orange-500" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage notifications, appearance, account preferences, security, integrations, marketplaces, and support.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value={SETTINGS_TAB_MARKETPLACES} className="gap-1.5">
            <Store className="w-3.5 h-3.5" />
            Marketplaces
          </TabsTrigger>
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
        <TabsContent value={SETTINGS_TAB_MARKETPLACES} className="mt-6">
          <MarketplacesPage embedded />
        </TabsContent>
        <TabsContent value="support" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Submit a ticket, view replies from our team, and follow up here. We also email your Ecommerce Guru account.
          </p>
          <SupportTicketForm compact />
          <SupportTicketInbox />
        </TabsContent>
      </Tabs>
    </div>
  );
}