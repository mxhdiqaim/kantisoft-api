import {boolean, doublePrecision, pgTable, text, timestamp, uuid} from "drizzle-orm/pg-core";

export const menuItems = pgTable('menuItems', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull().unique(),
    price: doublePrecision('price').notNull(),
    isAvailable: boolean('isAvailable').notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});

export type MenuSchemaT = typeof menuItems.$inferSelect;