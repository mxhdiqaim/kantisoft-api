import { relations } from "drizzle-orm";
import { users } from "../users-schema";
import { orders } from "../orders-schema";
import { stores } from "../stores-schema";

export const usersRelations = relations(users, ({ one, many }) => ({
    orders: many(orders),
    // A user belongs to one store
    store: one(stores, {
        fields: [users.storeId],
        references: [stores.id],
    }),
}));
