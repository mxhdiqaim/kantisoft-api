import { relations } from "drizzle-orm";
import { stores } from "../stores-schema";
import { users } from "../users-schema";
import { menuItems } from "../menu-items-schema";
import { orders } from "../orders-schema";

export const storeRelations = relations(stores, ({ one, many }) => ({
    // A store can have many users (employees)
    users: many(users),
    // A store can have many menu items
    menuItems: many(menuItems),
    // A store can have many orders
    orders: many(orders),

    // Defines the "child-to-parent" relationship.
    // A branch has one parent store.
    parent: one(stores, {
        fields: [stores.storeParentId],
        references: [stores.id],
        relationName: "storeHierarchy",
    }),

    // Defines the "parent-to-child" relationship.
    // A parent store can have many branches.
    branches: many(stores, {
        relationName: "storeHierarchy",
    }),
}));
