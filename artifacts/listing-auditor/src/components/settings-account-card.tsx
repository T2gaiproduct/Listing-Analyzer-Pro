import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { Building2, Mail, UserCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/hooks/use-workspace";

const STORAGE_KEY = "la_default_workspace_id";

function readDefaultWorkspaceId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function SettingsAccountCard() {
  const { user } = useUser();
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const loginEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "—";
  const storedDefault = readDefaultWorkspaceId();
  const defaultWorkspaceValue = storedDefault || (activeWorkspaceId ? String(activeWorkspaceId) : "");

  const onDefaultWorkspaceChange = (value: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) {
      setActiveWorkspaceId(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCircle className="w-4 h-4 text-orange-500" />
          Account
        </CardTitle>
        <CardDescription>
          Your sign-in details and default workspace for this browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Mail className="w-3.5 h-3.5" />
            Login email
          </div>
          <p className="text-sm font-medium text-slate-900 break-all">{loginEmail}</p>
          <p className="text-xs text-slate-500">
            Email is managed through your sign-in provider. Notification emails are sent to this address.
          </p>
        </div>

        {workspaces.length > 0 ? (
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Building2 className="w-4 h-4 text-slate-500" />
              Default workspace
            </Label>
            <Select value={defaultWorkspaceValue} onValueChange={onDefaultWorkspaceChange}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={String(ws.id)}>
                    {ws.name}
                    {ws.isDefault ? " (account default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Used when you sign in on this device. You can still switch workspaces from the top bar.
            </p>
          </div>
        ) : null}

        <Button asChild variant="outline" size="sm">
          <Link href="/profile">Edit profile & company details</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
