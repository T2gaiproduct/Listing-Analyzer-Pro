import { Router, type IRouter } from "express";
import healthRouter from "./health";
import auditsRouter from "./audits";
import competitorsRouter from "./competitors";

const router: IRouter = Router();

router.use(healthRouter);
router.use(auditsRouter);
router.use(competitorsRouter);

export default router;
