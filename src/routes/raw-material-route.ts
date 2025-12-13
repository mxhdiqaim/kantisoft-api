import express from "express";
import * as controller from "../controllers/raw-material-controller";

const router = express.Router();

router.get("/", controller.getAllRawMaterial);
router.get("/:id", controller.getSingleRawMaterial);
router.post("/create", controller.createRawMaterial);
router.patch("/:id", controller.updateRawMaterial);
router.delete("/:id", controller.deleteRawMaterial);

export default router;
