import express from "express";

import users from "./users-routes";
import menuItems from "./menu-items-routes";
import orders from "./order-routes";
import dashboard from "./dashboard-routes";
import stores from "./store-routes";

import { protectedRoute } from "../config/jwt-config";
import { isManager } from "../middlewares/is-manager-middleware";

const router = express.Router();

router.use("/users", users);
router.use("/menu-items", protectedRoute, menuItems);
router.use("/orders", protectedRoute, orders);
router.use("/dashboard", protectedRoute, dashboard);
router.use("/stores", protectedRoute, isManager, stores);

export default router;
