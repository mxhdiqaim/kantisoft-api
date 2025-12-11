import { relations } from "drizzle-orm";
import { menuItems } from "../menu-items-schema";
import { orderItems } from "../orders-schema";
import { stores } from "../stores-schema";
import { inventory } from "../inventory-schema";
import { billOfMaterials } from "../bill-of-materials-schema";

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
    orderItems: many(orderItems),
    // A menu item belongs to one store
    store: one(stores, {
        fields: [menuItems.storeId],
        references: [stores.id],
    }),

    inventory: one(inventory, {
        fields: [menuItems.id],
        references: [inventory.menuItemId],
    }),

    billOfMaterials: many(billOfMaterials),
}));
