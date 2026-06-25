import type { WebSocket } from "ws";
import { logger } from "./logger";

export interface WsMessage {
  type: string;
  payload?: unknown;
}

class WsManager {
  private connections = new Map<string, Set<WebSocket>>();

  add(userId: string, ws: WebSocket) {
    const set = this.connections.get(userId) ?? new Set();
    set.add(ws);
    this.connections.set(userId, set);
    ws.on("close", () => this.remove(userId, ws));
    ws.on("error", () => this.remove(userId, ws));
  }

  remove(userId: string, ws: WebSocket) {
    const set = this.connections.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.connections.delete(userId);
  }

  send(userId: string, msg: WsMessage) {
    const set = this.connections.get(userId);
    if (!set) return;
    const text = JSON.stringify(msg);
    for (const ws of set) {
      if (ws.readyState === 1) {
        ws.send(text);
      }
    }
  }

  broadcast(msg: WsMessage) {
    const text = JSON.stringify(msg);
    for (const set of this.connections.values()) {
      for (const ws of set) {
        if (ws.readyState === 1) {
          ws.send(text);
        }
      }
    }
  }
}

export const wsManager = new WsManager();

export function wsSend(userId: string, type: string, payload: unknown): void {
  wsManager.send(userId, { type, payload });
}
