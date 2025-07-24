import express from "express";

import users from "./users-routes";
import menuItems from "./menu-items-routes";
import orders from "./order-routes";
import dashboard from "./dashboard-routes";
import stores from "./store-routes";
import activities from "./activity-routes";
import auth from "./auth-routes";

import { protectedRoute } from "../config/jwt-config";
import { isManager } from "../middlewares/is-manager-middleware";
import { checkStoreAccess } from "../middlewares/check-store-access";

const router = express.Router();

// Public authentication routes
router.use("/api", auth); // Handles /api/register, /api/login, /api/logout (logout is protected within auth-routes)

// All subsequent routes are protected
router.use(protectedRoute);

// User management routes (now fully protected)
router.use("/users", users);

// Store CRUD is for Managers only
router.use("/stores", stores);

// Activity log is for Managers only
router.use("/activities", isManager, activities);

// These routes need to be protected and scoped to the user's store
router.use("/menu-items", checkStoreAccess, menuItems);
router.use("/orders", checkStoreAccess, orders);
router.use("/dashboard", checkStoreAccess, dashboard);

export default router;
