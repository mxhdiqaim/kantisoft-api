import {
    boolean,
    doublePrecision,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

// Define the core categories of measurement
export const unitFamilyEnum = pgEnum("unitFamily", [
    "weight", // Mass (e.g. kg, g)
    "volume", // Liquid/Capacity (e.g. L, ml)
    "count", // Discrete units (e.g. unit, dozen)
    "area", // (Optional: m², sq ft)
]);

export const unitOfMeasurement = pgTable(
    "unitOfMeasurement",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        // The display name of the unit (what the user sees)
        name: text("name").notNull(), // e.g., "Kilogram", "Gram", "Litre", "Dozen"

        // The short code (used in display/calculations)
        symbol: text("symbol").notNull(), // e.g., "kg", "g", "L", "unit"

        unitFamily: unitFamilyEnum("unitFamily").notNull(), // e.g., "WEIGHT", "VOLUME", "COUNT"

        // The factor to convert THIS unit to the internal system's BASE UNIT (e.g. 1000 for 1 kg -> 1000 g)
        conversionFactorToBase: doublePrecision("conversionFactorToBase")
            .notNull()
            .default(1),

        isBaseUnit: boolean("isBaseUnit").notNull().default(false), // True for the base unit in a family (e.g. 'g')

        createdAt: timestamp("createdAt").defaultNow().notNull(),
        lastModified: timestamp("lastModified")
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
    (table) => {
        return {
            unitSymbolUnique: uniqueIndex("unit_symbol_unique").on(
                table.symbol,
            ),
            unitNameUnique: uniqueIndex("unit_name_unique").on(table.name),
        };
    },
);
export type UnitOfMeasurementSchemaT = typeof unitOfMeasurement.$inferSelect;
export type InsertUnitOfMeasurementSchemaT =
    typeof unitOfMeasurement.$inferInsert;

export type UnitFamilyType = (typeof unitFamilyEnum.enumValues)[number];
