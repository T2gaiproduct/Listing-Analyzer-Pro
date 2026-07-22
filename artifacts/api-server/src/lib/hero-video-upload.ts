import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { isAdminUser } from "./admin-auth.js";
import { saveHeroVideo } from "./hero-video-storage.js";

export async function handleHeroVideoUpload(req: Request, res: Response): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const email = auth?.sessionClaims?.email as string | undefined;
  const ok = await isAdminUser(userId, email);
  if (!ok) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
  if (buffer.length === 0) {
    res.status(400).json({ error: "No video data provided" });
    return;
  }

  try {
    const filename = typeof req.headers["x-filename"] === "string" ? req.headers["x-filename"] : undefined;
    const mimeType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : undefined;
    const url = saveHeroVideo(buffer, mimeType, filename);
    res.status(201).json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
}
