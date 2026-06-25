import type { Request } from "express";
import type { WebSocket } from "ws";
import { wsManager } from "../lib/ws";
import { logger } from "../lib/logger";

export function wsHandler(ws: WebSocket, req: Request) {
  // Store pending auth on the connection
  let userId: string | null = null;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as {
        type: string;
        userId?: string;
      };

      if (msg.type === "auth" && msg.userId) {
        userId = msg.userId;
        wsManager.add(userId, ws);
        ws.send(JSON.stringify({ type: "connected", payload: { userId } }));
        return;
      }
    } catch {
      // ignore malformed messages
    }
  });

  // If auth hasn't happened after 5s, close the connection
  const timeout = setTimeout(() => {
    if (!userId) {
      ws.close(1008, "Unauthorized");
    }
  }, 5000);

  ws.on("close", () => {
    clearTimeout(timeout);
    if (userId) {
      wsManager.remove(userId, ws);
    }
  });

  ws.on("error", () => {
    clearTimeout(timeout);
    if (userId) {
      wsManager.remove(userId, ws);
    }
  });
}
