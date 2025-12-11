import {
    doublePrecision,
    pgEnum,
    pgTable,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import { stores } from "../stores-schema";
import { rawMaterials } from "./index";

export const rawInventoryStatusEnum = pgEnum("rawInventoryStatus", [
    "inStock",
    "lowStock",
    "outOfStock",
    "onOrder", // Can be useful for purchase tracking
]);

export const rawMaterialInventory = pgTable(
    "rawMaterialInventory",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        rawMaterialId: uuid("rawMaterialId")
            .notNull()
            .references(() => rawMaterials.id),
        storeId: uuid("storeId")
            .notNull()
            .references(() => stores.id),

        // Core Inventory Fields
        quantity: doublePrecision("quantity").notNull().default(0), // Current stock level
        minStockLevel: doublePrecision("minStockLevel").notNull().default(0), // Reorder point
        status: rawInventoryStatusEnum("status").notNull().default("inStock"),

        createdAt: timestamp("createdAt").defaultNow().notNull(),
        lastModified: timestamp("lastModified")
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
    (table) => {
        return {
            // A raw material can only have ONE inventory record per store.
            rawMaterialStoreUnique: unique(
                "raw_inventory_material_store_unique",
            ).on(table.rawMaterialId, table.storeId),
        };
    },
);
export type RawMaterialInventorySchemaT =
    typeof rawMaterialInventory.$inferSelect;
