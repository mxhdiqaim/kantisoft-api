import express from "express";
import * as controller from "../controllers/unit-of-measurement-controller";

const router = express.Router();

router.get("/", controller.getAllUnitsOfMeasurement);

export = router;
