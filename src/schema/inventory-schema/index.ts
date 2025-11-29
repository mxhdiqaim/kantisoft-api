import {
    doublePrecision,
    integer,
    pgEnum,
    pgTable,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import { menuItems } from "../menu-items-schema";
import { stores } from "../stores-schema";

// Inventory type (Stock, Waste, etc.) might be useful later, but for now, we focus on status
export const inventoryStatusEnum = pgEnum("inventoryStatus", [
    "inStock", // Currently available to be sold
    "lowStock", // Below the minimum threshold
    "outOfStock", // Zero or less
    "adjustment", // Manual adjustment made
    "discontinued", // No longer tracked
]);

export const inventory = pgTable(
    "inventory",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        menuItemId: uuid("menuItemId")
            .notNull()
            .references(() => menuItems.id, { onDelete: "cascade" }),
        storeId: uuid("storeId")
            .notNull()
            .references(() => stores.id, { onDelete: "cascade" }),

        // Core Inventory Fields
        quantity: doublePrecision("quantity").notNull().default(0),
        minStockLevel: integer("minStockLevel").notNull().default(10),
        status: inventoryStatusEnum("status").notNull().default("inStock"),

        // Auditing/Tracking
        lastCountDate: timestamp("lastCountDate").defaultNow().notNull(), // When was the quantity last updated?

        createdAt: timestamp("createdAt").defaultNow().notNull(),
        lastModified: timestamp("lastModified")
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
    (table) => {
        return {
            // A menu item/product can only have ONE inventory record per store.
            menuItemStoreUnique: unique("inventory_menuItem_store_unique").on(
                table.menuItemId,
                table.storeId,
            ),
        };
    },
);

export type InventorySchemaT = typeof inventory.$inferSelect;
export type InsertInventorySchemaT = typeof inventory.$inferInsert;
// export type InventoryStatusType = typeof inventory.$inferSelect.status;
