import { Router, type IRouter } from "express";
import healthRouter from "./health";
import auditsRouter from "./audits";
import competitorsRouter from "./competitors";
import fetchListingRouter from "./fetch-listing";
import adminRouter from "./admin";
import publicRouter from "./public";
import teamRouter from "./team";
import stripeRouter from "./stripe";
import paymentRouter from "./payment";
import graphicsRouter from "./graphics";
import archiveRouter from "./archive";
import recentsRouter from "./recents";
import dashboardRouter from "./dashboard";
import amazonRouter from "./amazon";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fetchListingRouter);
router.use(adminRouter);
router.use(publicRouter);
router.use(teamRouter);
router.use(auditsRouter);
router.use(competitorsRouter);
router.use(stripeRouter);
router.use(paymentRouter);
router.use(graphicsRouter);
router.use(archiveRouter);
router.use(recentsRouter);
router.use(dashboardRouter);
router.use(amazonRouter);

export default router;
