import type { WebSocket } from "ws";
import { verifyToken } from "@clerk/backend";
import { wsManager } from "../lib/ws";
import { logger } from "../lib/logger";

export function wsHandler(ws: WebSocket) {
  let userId: string | null = null;
  let authenticated = false;

  ws.on("message", (data) => {
    void (async () => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type: string;
          token?: string;
        };

        if (msg.type !== "auth" || !msg.token || authenticated) {
          return;
        }

        const secretKey = process.env.CLERK_SECRET_KEY;
        if (!secretKey) {
          ws.close(1011, "Auth unavailable");
          return;
        }

        const payload = await verifyToken(msg.token, { secretKey });
        const verifiedUserId = payload.sub;
        if (!verifiedUserId) {
          ws.close(1008, "Unauthorized");
          return;
        }

        userId = verifiedUserId;
        authenticated = true;
        wsManager.add(verifiedUserId, ws);
        ws.send(JSON.stringify({ type: "connected", payload: { userId: verifiedUserId } }));
      } catch (err) {
        logger.warn({ err }, "WebSocket auth failed");
        ws.close(1008, "Unauthorized");
      }
    })();
  });

  const timeout = setTimeout(() => {
    if (!authenticated) {
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
