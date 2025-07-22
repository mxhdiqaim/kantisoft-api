import express from "express";
import * as controller from "../controllers/activity-controller";

const router = express.Router();

// This endpoint will fetch the activity log
router.get("/", controller.getActivities);

export default router;
