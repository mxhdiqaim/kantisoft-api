import { relations } from "drizzle-orm";
import { menuItems } from "../menu-items-schema";
import { orderItems, orders } from "../orders-schema";
import { users } from "../users-schema";
import { stores } from "../stores-schema";

export const ordersRelations = relations(orders, ({ one, many }) => ({
    seller: one(users, {
        fields: [orders.sellerId],
        references: [users.id],
    }),
    orderItems: many(orderItems),
    store: one(stores, {
        fields: [orders.storeId],
        references: [stores.id],
    }),
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
