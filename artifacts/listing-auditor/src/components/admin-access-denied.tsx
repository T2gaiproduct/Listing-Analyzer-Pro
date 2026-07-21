import { ShieldOff } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function AdminAccessDenied({ defaultRoute }: { defaultRoute?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <ShieldOff className="w-6 h-6 text-slate-500" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-slate-900">Access denied</p>
          <p className="text-sm text-slate-500">
            Your admin role does not include permission to view this page. Contact a super admin if you need access.
          </p>
        </div>
        {defaultRoute && (
          <Button asChild variant="outline">
            <Link href={defaultRoute}>Go to your admin home</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
