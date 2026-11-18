import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings, Store } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsAppearanceCard } from "@/components/settings-appearance-card";
import { SettingsAccountCard } from "@/components/settings-account-card";
import { SettingsSecurityCard } from "@/components/settings-security-card";
import { NotificationPreferencesCategorySection } from "@/components/notification-preferences-card";
import MarketplacesPage from "@/pages/marketplaces";
import { cn } from "@/lib/utils";
import {
  SETTINGS_PAGE_TAB_LABELS,
  SETTINGS_PAGE_TAB_ORDER,
  SETTINGS_TAB_MARKETPLACES,
  isNotificationSettingsTab,
  parseSettingsPageTab,
  settingsHrefForTab,
  type SettingsPageTab,
} from "@/lib/settings-nav";

export default function SettingsPage() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const [tab, setTab] = useState<SettingsPageTab>(() => parseSettingsPageTab(new URLSearchParams(search).get("tab")));

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("tab") === "support") {
      setLocation("/support-ticket");
      return;
    }
    setTab(parseSettingsPageTab(params.get("tab")));
  }, [location, search, setLocation]);

  const onTabChange = useCallback(
    (value: string) => {
      const next = parseSettingsPageTab(value);
      setTab(next);
      setLocation(settingsHrefForTab(next));
    },
    [setLocation],
  );

  const notificationTabs = useMemo(
    () => SETTINGS_PAGE_TAB_ORDER.filter(isNotificationSettingsTab),
    [],
  );

  return (
    <div className="w-full min-w-0 max-w-none space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-orange-500" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage account preferences, notifications, security, and marketplaces.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full min-w-0">
        <TabsList className="h-auto w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 p-1">
          {SETTINGS_PAGE_TAB_ORDER.map((tabId) => (
            <TabsTrigger key={tabId} value={tabId} className="gap-1.5 text-xs sm:text-sm w-full min-w-0 px-2">
              {tabId === SETTINGS_TAB_MARKETPLACES ? <Store className="w-3.5 h-3.5 shrink-0" /> : null}
              {SETTINGS_PAGE_TAB_LABELS[tabId]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="general" className="space-y-6 mt-6">
          <SettingsAccountCard />
          <SettingsAppearanceCard />
          <SettingsSecurityCard />
        </TabsContent>
        <TabsContent value={SETTINGS_TAB_MARKETPLACES} className="mt-6">
          <MarketplacesPage embedded />
        </TabsContent>
        {notificationTabs.map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            <NotificationPreferencesCategorySection category={category} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}