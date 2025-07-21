import express from "express";
import { protectedRoute } from "../config/jwt-config";
import * as controller from "../controllers/user-controller";
import { isAdmin } from "../middlewares/is-admin-middleware";

const router = express.Router();

router.get("/", protectedRoute, isAdmin, controller.getAllUsers);
router.get("/access", protectedRoute, controller.getUserAccess);
router.post("/create", protectedRoute, isAdmin, controller.createUser);
router.post("/login", controller.loginUser);
router.post("/logout", controller.logoutUser);

export = router;
