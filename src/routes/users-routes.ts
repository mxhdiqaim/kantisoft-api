import express from "express";
import * as controller from "../controllers/users-controllers";

const router = express.Router();

router.get("/", controller.getAllUsers);
router.post("/", controller.createUser);
router.get("/access", controller.getUserAccess);

// auth routes
router.post("/login", controller.loginUser);

export = router;
