import { Router } from "express";
import * as controller from "../controllers/store-controller";
import { isManager } from "../middlewares/is-manager-middleware";

const router = Router();

router.get("/", controller.getAllStores);
router.get("/:id", controller.getStoreById);
router.post("/create", isManager, controller.createStore);
router.patch("/:id", isManager, controller.updateStore);
router.delete("/:id", isManager, controller.deleteStore);

export default router;
