import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchUnreadCount(): Promise<number> {
  const r = await fetch(`${basePath}/api/notifications?limit=100`, { credentials: "include" });
  if (!r.ok) return 0;
  const data = (await r.json()) as { notifications?: Array<{ read: boolean }> };
  return (data.notifications ?? []).filter((n) => !n.read).length;
}

export function AdminNotificationBell({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000,
  });

  return (
    <Link
      href="/admin/notifications"
      onClick={onNavigate}
      aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
      className={cn("relative flex items-center justify-center", className)}
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-900">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
