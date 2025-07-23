import express from "express";
import { protectedRoute } from "../config/jwt-config";
import * as controller from "../controllers/user-controller";
import { isAuthorized } from "../middlewares/is-authorised-middleware";
import { UserRoleEnum } from "../types/enums";

const router = express.Router();

router.get(
    "/",
    protectedRoute,
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.getAllUsers,
);
router.get(
    "/:id",
    protectedRoute,
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.getUserById,
);
router.get("/access", protectedRoute, controller.getUserAccess);
router.post(
    "/create",
    protectedRoute,
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.createUser,
);
router.post("/login", controller.loginUser);
router.post("/logout", controller.logoutUser);
router.patch("/:id", protectedRoute, controller.updateUser);

router.delete(
    "/:id",
    protectedRoute,
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.deleteUser,
);

export = router;
