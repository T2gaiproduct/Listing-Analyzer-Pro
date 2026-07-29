import type { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function clientKey(req: Request, route: string): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string"
    ? forwarded.split(",")[0]?.trim()
    : req.socket.remoteAddress ?? "unknown";
  return `${route}:${ip}`;
}

export function rateLimit(options: { windowMs: number; max: number; route: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = clientKey(req, options.route);
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.max) {
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }

    existing.count += 1;
    next();
  };
}
