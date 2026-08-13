import { Link } from "wouter";
import { KeyRound, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { settingsPanelClassName } from "@/components/settings-panel";

export function SettingsSecurityCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-4 h-4 text-orange-500" />
          Security
        </CardTitle>
        <CardDescription>
          Manage your password and account security.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={cn(settingsPanelClassName(), "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3")}>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              Password
            </p>
            <p className="text-xs text-muted-foreground">
              Change your account password from your profile page.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/profile">Change password</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Two-factor authentication and session management are handled by your Clerk sign-in account.
        </p>
      </CardContent>
    </Card>
  );
}
