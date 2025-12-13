import Express from "express";
import * as controller from "../controllers/raw-material-inventory-controller";

const router = Express.Router();

router.get("/:id", controller.getCurrentRawMaterialStock);
router.post("/create", controller.createRawMaterialInventoryRecord);

export default router;
