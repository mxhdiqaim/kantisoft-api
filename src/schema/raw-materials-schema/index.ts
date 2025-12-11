import {
    doublePrecision,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { unitOfMeasurement } from "../unit-of-measurement-schema";

// Raw Material Master List (Platform-wide)
export const rawMaterials = pgTable(
    "rawMaterials",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        name: text("name").notNull(), // e.g. "All-Purpose Flour", "Grade A Eggs"

        // References to the unit used for presentation/purchasing (e.g., "Kilogram")
        unitOfMeasurementId: uuid("unitOfMeasurementId")
            .notNull()
            .references(() => unitOfMeasurement.id, { onDelete: "restrict" }),

        description: text("description"),
        latestUnitPrice: doublePrecision("latestUnitPrice")
            .notNull()
            .default(0), // Cost per UnitOfMeasure

        createdAt: timestamp("createdAt").defaultNow().notNull(),
        lastModified: timestamp("lastModified")
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
    (table) => {
        return {
            rawMaterialNameUnique: uniqueIndex("raw_material_name_unique").on(
                table.name,
            ),
        };
    },
);
export type RawMaterialSchemaT = typeof rawMaterials.$inferSelect;
export type InsertRawMaterialSchemaT = typeof rawMaterials.$inferInsert;
