import { Router } from "express";
import * as controller from "../controllers/inventory-controller";
import { isAuthorized } from "../middlewares/is-authorised-middleware";
import { UserRoleEnum } from "../types/enums";
// import { isManager } from "../middlewares/is-manager-middleware";

const router = Router();

router.get("/", controller.getAllInventory);
router.get("/:id", controller.getInventoryByMenuItem);
router.post("/create", controller.createInventoryRecord);
router.patch("/adjust-stock/:id", controller.adjustStock);
router.patch(
    "/discontinue/:id",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.markAsDiscontinued,
);
router.delete(
    "/:id",
    isAuthorized([UserRoleEnum.MANAGER, UserRoleEnum.ADMIN]),
    controller.deleteInventoryRecord,
);

export default router;
