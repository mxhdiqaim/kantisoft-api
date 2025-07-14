import { relations } from "drizzle-orm";
import { users } from "../users-schema";
import { orders } from "../orders-schema";

export const usersRelations = relations(users, ({ many }) => ({
    orders: many(orders),
}));
