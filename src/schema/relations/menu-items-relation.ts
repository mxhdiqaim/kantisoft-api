import {relations} from "drizzle-orm";
import {menuItems} from "../menu-items-schema";
import {orderItems} from "../orders-schema";

export const menuItemsRelations = relations(menuItems, ({ many }) => ({
    orderItems: many(orderItems),
}));