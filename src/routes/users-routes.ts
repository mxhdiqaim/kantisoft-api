import express from "express";
// import { protectedRoute } from "../config/jwt-config";
import * as controller from "../controllers/user-controller";
import { isAuthorized } from "../middlewares/is-authorised-middleware";
import { UserRoleEnum } from "../types/enums";
import { isManager } from "../middlewares/is-manager-middleware";

const router = express.Router();

router.get(
    "/",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.getAllUsers,
);
router.get("/:id", controller.getUserById);
router.get("/access", controller.getUserAccess);
router.post(
    "/create",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]), // Only Managers/Admins can create users
    controller.createUser,
);

router.patch("/:id", controller.updateUser);
router.patch("/update-password", controller.updatePassword);
router.patch("/:id/change-store", isManager, controller.changeUserStore);

router.delete(
    "/:id",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]), // Only Managers/Admins can delete users
    controller.deleteUser,
);

export = router;
