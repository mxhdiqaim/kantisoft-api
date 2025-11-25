import express from "express";
import * as controller from "../controllers/menu-items-controller";
import { isAuthorized } from "../middlewares/is-authorised-middleware";
import { UserRoleEnum } from "../types/enums";

const router = express.Router();

router.get("/", controller.getAllMenuItems);
router.get(
    "/store-and-branches",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.getAllMenuItemsFromStoreAndBranches,
);
router.get("/:id", controller.getMenuItemById);

router.post(
    "/create",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.createMenuItem,
);
router.patch(
    "/:id",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN, UserRoleEnum.USER]),
    controller.updateMenuItem,
);
router.delete(
    "/:id",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.deleteMenuItem,
);

export = router;
