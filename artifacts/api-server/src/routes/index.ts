import { Router, type IRouter } from "express";
import healthRouter from "./health";
import auditsRouter from "./audits";
import competitorsRouter from "./competitors";
import fetchListingRouter from "./fetch-listing";
import adminRouter from "./admin";
import publicRouter from "./public";
import teamRouter from "./team";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fetchListingRouter);
router.use(adminRouter);
router.use(publicRouter);
router.use(teamRouter);
router.use(auditsRouter);
router.use(competitorsRouter);

export default router;
