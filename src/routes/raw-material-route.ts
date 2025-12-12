import express from "express";
import * as controller from "../controllers/raw-material-controller";

const router = express.Router();

// get all raw material
router.get("/", controller.getAllRawMaterial);
router.post("/create", controller.createRawMaterial);

export default router;
