import { relations } from "drizzle-orm";
import { inventoryTransactions } from "../inventory-schema/inventory-transaction-schema";
import { users } from "../users-schema";
import { menuItems } from "../menu-items-schema";
import { stores } from "../stores-schema";

export const inventoryTransactionsRelations = relations(
    inventoryTransactions,
    ({ one }) => ({
        // Relation 1: Link performedBy to the user's table
        performedByUser: one(users, {
            // The foreign key column in inventoryTransactions
            fields: [inventoryTransactions.performedBy],
            // The primary key column in the user's table
            references: [users.id],
        }),

        // Relation 2: Link menuItemId to the menuItems table
        menuItem: one(menuItems, {
            fields: [inventoryTransactions.menuItemId],
            references: [menuItems.id],
        }),

        // Relation 3: Link storeId to the stores table (good practice to include)
        store: one(stores, {
            fields: [inventoryTransactions.storeId],
            references: [stores.id],
        }),
    }),
);
