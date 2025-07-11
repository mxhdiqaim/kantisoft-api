import express from "express";
import {protectedRoute} from "../config/jwt-config";
import * as controller from "../controllers/user-controller";

const router = express.Router();

router.get("/", protectedRoute, controller.getAllUsers);
router.get("/access", protectedRoute, controller.getUserAccess);
router.post("/create", protectedRoute, controller.createUser);
router.post("/login", controller.loginUser);
router.post("/logout", controller.logoutUser);


export = router;
