import {boolean, doublePrecision, pgTable, text, uuid} from "drizzle-orm/pg-core";

export const menuItems = pgTable('menuItems', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull().unique(),
    price: doublePrecision('price').notNull(),
    isAvailable: boolean('isAvailable').notNull().default(true),
});

export type MenuSchemaT = typeof menuItems.$inferSelect;