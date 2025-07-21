import { relations } from "drizzle-orm";
import { stores } from "../stores-schema";
import { users } from "../users-schema";
import { menuItems } from "../menu-items-schema";
import { orders } from "../orders-schema";

export const storeRelations = relations(stores, ({ many }) => ({
    // A store can have many users (employees)
    users: many(users),
    // A store can have many menu items
    menuItems: many(menuItems),
    // A store can have many orders
    orders: many(orders),
}));
