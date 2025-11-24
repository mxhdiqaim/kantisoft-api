import express from "express";

import users from "./users-routes";
import menuItems from "./menu-items-routes";
import orders from "./order-routes";
import dashboard from "./dashboard-routes";
import stores from "./store-routes";
import activities from "./activity-routes";
import inventory from "./inventory-routes";
import auth from "./auth-routes";
import { protectedRoute } from "../config/jwt-config";
import { checkUserHasStore } from "../middlewares/check-user-has-store";
import { isAuthorized } from "../middlewares/is-authorised-middleware";
import { UserRoleEnum } from "../types/enums";
import { StatusCodes } from "http-status-codes";

const router = express.Router();

router.get("/health", (_req, res) => {
    res.status(StatusCodes.OK).json({
        status: "ok",
        message: "API is up and running",
        timestamp: new Date().toISOString(),
    });
});

// Public authentication routes
router.use("/auth", auth); // Handles /api/v1/auth/register, /api/v1/auth/login, /api/v1/auth/logout (logout is protected within auth-routes)

// All subsequent routes are protected
router.use(protectedRoute);

// User management routes (now fully protected)
router.use("/users", users);

// Store CRUD is for Managers only
router.use("/stores", stores);

// Inventory management routes
router.use("/inventory", inventory);

// Activity log is for Managers & admin only
router.use(
    "/activities",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    activities,
);

// These routes need to be protected and scoped to the user's store
router.use("/menu-items", checkUserHasStore, menuItems);
router.use("/orders", checkUserHasStore, orders);
router.use("/dashboard", checkUserHasStore, dashboard);

export default router;
