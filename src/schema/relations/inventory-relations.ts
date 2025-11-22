import { relations } from "drizzle-orm";
import { inventoryTransactions } from "../inventory-schema/inventory-transaction-schema";
import { users } from "../users-schema";
import { menuItems } from "../menu-items-schema";
import { stores } from "../stores-schema";
import { inventory } from "../inventory-schema";

export const inventoryRelations = relations(inventory, ({ one }) => ({
    menuItem: one(menuItems, {
        fields: [inventory.menuItemId],
        references: [menuItems.id],
    }),
    store: one(stores, {
        fields: [inventory.storeId],
        references: [stores.id],
    }),
}));

export const inventoryTransactionsRelations = relations(
    inventoryTransactions,
    ({ one }) => ({
        // Link performedBy to the user's table
        performedByUser: one(users, {
            // The foreign key column in inventoryTransactions
            fields: [inventoryTransactions.performedBy],
            // The primary key column in the user's table
            references: [users.id],
        }),

        // Link menuItemId to the menuItems table
        menuItem: one(menuItems, {
            fields: [inventoryTransactions.menuItemId],
            references: [menuItems.id],
        }),

        // Link storeId to the stores table (good practice to include)
        store: one(stores, {
            fields: [inventoryTransactions.storeId],
            references: [stores.id],
        }),
    }),
);
