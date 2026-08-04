import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useUser, useAuth } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useWsNotifications() {
  const qc = useQueryClient();
  const { user } = useUser();
  const { getToken } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;
    const url = `wss://${window.location.host}${basePath}/api/ws`;

    function connect() {
      if (pausedRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        void (async () => {
          const token = await getToken();
          if (!token) {
            ws.close();
            return;
          }
          ws.send(JSON.stringify({ type: "auth", token }));
        })();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            payload?: {
              id: number;
              type: string;
              title: string;
              message: string;
              sentAt: string;
            };
          };

          if (msg.type === "notification" && msg.payload) {
            qc.invalidateQueries({ queryKey: ["notifications"] });
            toast({
              title: msg.payload.title,
              description: msg.payload.message,
            });
          }
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!pausedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    function scheduleConnect() {
      const start = () => {
        if (!pausedRef.current) connect();
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(start, { timeout: 4000 });
      } else {
        setTimeout(start, 1500);
      }
    }

    function onVisibilityChange() {
      pausedRef.current = document.visibilityState === "hidden";
      if (pausedRef.current) {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        wsRef.current?.close();
        wsRef.current = null;
      } else {
        scheduleConnect();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    scheduleConnect();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user?.id, getToken, qc]);
}
