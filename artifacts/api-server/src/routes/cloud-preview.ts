import { Router, type IRouter } from "express";
import {
  isCloudPreviewSessionRequest,
  isCloudPreviewSkipAuthEnabled,
  mintCloudPreviewSessionToken,
  previewAuthUserIdFromEnv,
} from "../lib/cloud-preview-auth.js";

const router: IRouter = Router();

router.get("/cloud-preview/config", (_req, res) => {
  res.json({
    skipAuth: isCloudPreviewSkipAuthEnabled(),
    previewUserId: isCloudPreviewSkipAuthEnabled() ? previewAuthUserIdFromEnv() : null,
  });
});

router.post("/cloud-preview/session", (req, res) => {
  if (!isCloudPreviewSkipAuthEnabled()) {
    res.status(404).json({ error: "Not available" });
    return;
  }
  if (!isCloudPreviewSessionRequest(req)) {
    res.status(403).json({ error: "Cloud preview session is only allowed on quick tunnel hosts" });
    return;
  }

  const userId = previewAuthUserIdFromEnv();
  if (!userId) {
    res.status(503).json({
      error: "ADMIN_USER_IDS is not configured for preview auto sign-in",
    });
    return;
  }

  const token = mintCloudPreviewSessionToken(userId);
  res.json({
    userId,
    email: `preview+${userId.slice(-8)}@cloud-preview.local`,
    token,
  });
});

export default router;
