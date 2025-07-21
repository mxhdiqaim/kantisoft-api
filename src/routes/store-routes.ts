import { Router } from "express";
import * as controller from "../controllers/store-controller";

const router = Router();

router.get("/", controller.getAllStores);
router.get("/:id", controller.getStoreById);
router.post("/", controller.createStore);
router.patch("/:id", controller.updateStore);
router.delete("/:id", controller.deleteStore);

export default router;
