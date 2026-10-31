import { Router, type IRouter } from "express";
import {
  cloudPreviewDummyUserIdFromEnv,
  isCloudPreviewSessionRequest,
  isCloudPreviewSkipAuthEnabled,
  mintCloudPreviewSessionToken,
  parseCloudPreviewPersona,
  previewAuthUserIdFromEnv,
  previewUserIdForPersona,
} from "../lib/cloud-preview-auth.js";

const router: IRouter = Router();

router.get("/cloud-preview/config", (_req, res) => {
  const enabled = isCloudPreviewSkipAuthEnabled();
  res.json({
    skipAuth: enabled,
    previewUserId: enabled ? previewAuthUserIdFromEnv() : null,
    defaultPersona: enabled ? "customer" : null,
    customerUserId: enabled ? cloudPreviewDummyUserIdFromEnv() : null,
    adminUserId: enabled ? previewAuthUserIdFromEnv() : null,
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

  const persona = parseCloudPreviewPersona(
    typeof req.body === "object" && req.body !== null
      ? (req.body as { persona?: unknown }).persona
      : undefined,
  );

  const userId = previewUserIdForPersona(persona);
  if (!userId) {
    res.status(503).json({
      error:
        persona === "admin"
          ? "ADMIN_USER_IDS is not configured for preview admin sign-in"
          : "Cloud preview dummy customer id is not configured",
    });
    return;
  }

  const token = mintCloudPreviewSessionToken(userId);
  res.json({
    userId,
    email: `preview+${userId.slice(-8)}@cloud-preview.local`,
    token,
    persona,
  });
});

export default router;
