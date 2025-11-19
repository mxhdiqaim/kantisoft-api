import { Router } from "express";
import * as controller from "../controllers/inventory-controller";
// import { isManager } from "../middlewares/is-manager-middleware";

const router = Router();

router.get("/", controller.getAllInventory);
router.get("/:id", controller.getInventoryByMenuItem);
router.post("/create", controller.createInventoryRecord);
router.patch("/:id", controller.adjustStock);

export default router;
