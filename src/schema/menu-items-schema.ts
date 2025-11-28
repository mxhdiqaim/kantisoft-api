import {
    boolean,
    numeric,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores-schema";

export const menuItems = pgTable(
    "menuItems",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        name: text("name").notNull(),
        description: text("description"),
        itemCode: text("itemCode"),
        // sku: text("sku"),
        price: numeric("price", { precision: 10, scale: 2 }).notNull(),
        storeId: uuid("storeId").references(() => stores.id),
        // currentMenu: integer("currentMenu").notNull().default(0),
        // minMenuLevel: integer("minMenuLevel").default(10), // Minimum level for the menu item
        isAvailable: boolean("isAvailable").notNull().default(true),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        lastModified: timestamp("lastModified")
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
    (table) => {
        return {
            // Add a composite unique constraint on (storeId, name)
            menuItemNameUniquePerStore: unique(
                "menuItems_name_store_unique",
            ).on(table.storeId, table.name),
            // If itemCode should also be unique per store, add another composite constraint (optional)
            menuItemItemCodeUniquePerStore: unique(
                "menuItems_itemCode_store_unique",
            ).on(table.storeId, table.itemCode),
        };
    },
);

export type MenuSchemaT = typeof menuItems.$inferSelect;
export type InsertMenuSchemaT = typeof menuItems.$inferInsert;
