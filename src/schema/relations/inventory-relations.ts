import { relations } from "drizzle-orm";
import { menuItems } from "../menu-items-schema";
import { inventory } from "../inventory-schema";
import { stores } from "../stores-schema";

export const inventoryRelations = relations(inventory, ({ one }) => ({
    // Relation for 'menuItem'
    menuItem: one(menuItems, {
        fields: [inventory.menuItemId],
        references: [menuItems.id],
    }),

    // Relation for 'store'
    store: one(stores, {
        fields: [inventory.storeId],
        references: [stores.id],
    }),
}));
