import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchUnreadCount(): Promise<number> {
  const r = await fetch(`${basePath}/api/notifications?limit=100`, { credentials: "include" });
  if (!r.ok) return 0;
  const data = (await r.json()) as { notifications?: Array<{ read: boolean }> };
  return (data.notifications ?? []).filter((n) => !n.read).length;
}

export function CustomerNotificationBell({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const [, navigate] = useLocation();
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000,
  });

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        navigate("/notifications");
      }}
      aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
      className={cn(
        "relative flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-target",
        className,
      )}
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary border-2 border-card" />
      )}
    </button>
  );
}
