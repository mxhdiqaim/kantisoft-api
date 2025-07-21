import express from "express";
import { protectedRoute } from "../config/jwt-config";
import * as controller from "../controllers/user-controller";
import { isManager } from "../middlewares/is-manager-middleware";

const router = express.Router();

router.get("/", protectedRoute, isManager, controller.getAllUsers);
router.get("/access", protectedRoute, controller.getUserAccess);
router.post("/create", protectedRoute, isManager, controller.createUser);
router.post("/login", controller.loginUser);
router.post("/logout", controller.logoutUser);

export = router;
