import express from "express";

import users from "./users-routes";
import menuItems from "./menu-items-routes";
import orders from "./order-routes";
import dashboard from "./dashboard-routes";
import stores from "./store-routes";
import activities from "./activity-routes";

import { protectedRoute } from "../config/jwt-config";
import { isManager } from "../middlewares/is-manager-middleware";
import { checkStoreAccess } from "../middlewares/check-store-access";

const router = express.Router();

// User routes are mostly open or have specific protections inside the controller
router.use("/users", users);

// Store CRUD is for Managers only
router.use("/stores", protectedRoute, isManager, stores);

// Activity log is for Managers only
router.use("/activities", protectedRoute, isManager, activities);

// These routes need to be protected and scoped to the user's store
router.use("/menu-items", protectedRoute, checkStoreAccess, menuItems);
router.use("/orders", protectedRoute, checkStoreAccess, orders);
router.use("/dashboard", protectedRoute, checkStoreAccess, dashboard);

export default router;
