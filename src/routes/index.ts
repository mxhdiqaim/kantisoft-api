import express from "express";

import users from "./users-routes";
import menuItems from "./menu-items-routes";
import orders from './order-routes'

import {protectedRoute} from "../config/jwt-config";

const router = express.Router();

router.use("/users", users);
router.use("/menu-items", protectedRoute, menuItems)
router.use("/orders", protectedRoute, orders)

export default router;