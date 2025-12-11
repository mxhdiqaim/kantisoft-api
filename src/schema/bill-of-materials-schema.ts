import {
    doublePrecision,
    pgTable,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import { menuItems } from "./menu-items-schema";
import { rawMaterials } from "./raw-materials-schema";

export const billOfMaterials = pgTable(
    "billOfMaterials",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        menuItemId: uuid("menuItemId")
            .notNull()
            .references(() => menuItems.id, { onDelete: "restrict" }),
        rawMaterialId: uuid("rawMaterialId")
            .notNull()
            .references(() => rawMaterials.id, { onDelete: "restrict" }),

        // Core BOM Fields
        consumptionQuantityBase: doublePrecision(
            "consumptionQuantityBase",
        ).notNull(), // This consumption quantity MUST be stored in the material's BASE unit (e.g. 100 g)

        createdAt: timestamp("createdAt").defaultNow().notNull(),
        lastModified: timestamp("lastModified")
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
    (table) => {
        return {
            // A finished product (menuItem) can only contain one instance of a specific raw material.
            bomUnique: unique("bom_menuItem_material_unique").on(
                table.menuItemId,
                table.rawMaterialId,
            ),
        };
    },
);
export type BillOfMaterialsSchemaT = typeof billOfMaterials.$inferSelect;
export type InsertBillOfMaterialsSchemaT = typeof billOfMaterials.$inferInsert;
