import express from "express";
import * as controller from "../controllers/user-controller";
import { protectedRoute } from "../config/jwt-config";

const router = express.Router();

// Public route for new manager/store registration
router.post("/register", controller.registerManagerAndStore);

// Public route for logging in
router.post("/login", controller.loginUser);

// Protected route for logging out
router.post("/logout", protectedRoute, controller.logoutUser);

export = router;
