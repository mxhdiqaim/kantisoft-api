import {
    doublePrecision,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

// Raw Material Master List (Platform-wide)
export const rawMaterials = pgTable(
    "rawMaterials",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        name: text("name").notNull(), // e.g. "All-Purpose Flour", "Grade A Eggs"

        baseUnit: text("baseUnit").notNull(), // This is the BASE unit (e.g. 'gram', 'milliliter', 'unit')

        presentationUnit: text("presentationUnit").notNull(), // The common unit for purchasing/reporting (e.g. 'kg', 'litre', 'dozen')

        conversionFactor: doublePrecision("conversionFactor")
            .notNull()
            .default(1), // The factor to convert PresentationUnit to BaseUnit (e.g. 1000 g = 1 kg)

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
