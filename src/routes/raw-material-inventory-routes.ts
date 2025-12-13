import Express from "express";
import * as controller from "../controllers/raw-material-inventory-controller";

const router = Express.Router();

router.get("/:id", controller.getCurrentRawMaterialStock);
router.post("/create", controller.createRawMaterialInventoryRecord);
router.post("/:id/stock-in", controller.addStockToRawMaterial);

export default router;
