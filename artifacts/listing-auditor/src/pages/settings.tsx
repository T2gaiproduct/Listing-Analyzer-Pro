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

  const layoutWide = tab === SETTINGS_TAB_MARKETPLACES;
  const notificationTabs = useMemo(
    () => SETTINGS_PAGE_TAB_ORDER.filter(isNotificationSettingsTab),
    [],
  );

  return (
    <div className={cn("space-y-6", layoutWide ? "max-w-6xl" : "max-w-3xl")}>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-orange-500" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage account preferences, notifications, security, and marketplaces.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="h-auto w-full flex flex-wrap justify-start gap-1">
          {SETTINGS_PAGE_TAB_ORDER.map((tabId) => (
            <TabsTrigger key={tabId} value={tabId} className="gap-1.5 text-xs sm:text-sm">
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