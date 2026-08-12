import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    publishImageFix: "marketplace-direct-upload-v4",
  });
});

export default router;
