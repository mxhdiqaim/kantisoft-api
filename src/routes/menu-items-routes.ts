import express from "express";
import * as controller from "../controllers/menu-items-controller";

const router = express.Router();

router.get("/", controller.getAllMenuItems);
router.get("/:id", controller.getMenuItemById);
router.post("/create", controller.createMenuItem);
router.put("/:id", controller.updateMenuItem);
router.delete("/:id", controller.deleteMenuItem);

export = router;
