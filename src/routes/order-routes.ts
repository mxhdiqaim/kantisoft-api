import express from "express";
import * as controller from "../controllers/order-controller";

const router = express.Router();

router.get("/", controller.getAllOrders);
router.get("/by-period", controller.getOrdersByPeriod);
router.get("/:id", controller.getOrderById);
router.post("/create", controller.createOrder);
router.put("/:id", controller.updateOrderStatus);
router.delete("/:id", controller.deleteOrder);

export = router;
