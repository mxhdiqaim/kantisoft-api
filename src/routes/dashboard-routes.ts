import express from "express";
import * as controller from "../controllers/dashboard-controller";

const router = express.Router();

router.get("/sales-summary", controller.getSalesSummary);
router.get("/top-sells", controller.getTopSells);
router.get("/inventory-summary", controller.getInventorySummary);
router.get("/sales-trend", controller.getSalesTrend);

export = router;
