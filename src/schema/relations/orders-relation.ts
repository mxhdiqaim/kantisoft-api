import {relations} from "drizzle-orm";
import {menuItems} from "../menu-items-schema";
import {orderItems, orders} from "../orders-schema";


export const ordersRelations = relations(orders, ({ many }) => ({
    orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id],
    }),
    menuItem: one(menuItems, {
        fields: [orderItems.menuItemId],
        references: [menuItems.id],
    }),
}));