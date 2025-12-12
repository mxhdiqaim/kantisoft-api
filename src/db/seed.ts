import {
    InsertUnitOfMeasurementSchemaT,
    UnitFamilyType,
    unitOfMeasurement,
} from "../schema/unit-of-measurement-schema";
import db, { pool } from "./index";
import { sql } from "drizzle-orm";

const unitsSeedData: InsertUnitOfMeasurementSchemaT[] = [
    // Weight Units
    {
        name: "Gram",
        symbol: "g",
        unitFamily: "weight" as UnitFamilyType,
        isBaseUnit: true,
        conversionFactorToBase: 1,
        calculationLogic: "The base unit for all weight calculations.",
    },
    {
        name: "Kilogram",
        symbol: "kg",
        unitFamily: "weight" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 1000,
        calculationLogic: "1 kg = 1000 g",
    },
    {
        name: "Tonne (Metric Ton)",
        symbol: "t",
        unitFamily: "weight" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 1000000,
        calculationLogic: "1 t = 1,000,000 g (1,000 kg)",
    },
    {
        name: "Milligram",
        symbol: "mg",
        unitFamily: "weight" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 0.001,
        calculationLogic: "1 mg = 0.001 g",
    },

    // Volume Units
    {
        name: "Milliliter",
        symbol: "ml",
        unitFamily: "volume" as UnitFamilyType,
        isBaseUnit: true,
        conversionFactorToBase: 1,
        calculationLogic: "The base unit for all volume calculations.",
    },
    {
        name: "Liter",
        symbol: "L",
        unitFamily: "volume" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 1000,
        calculationLogic: "1 L = 1000 ml",
    },
    {
        name: "Cubic Meter",
        symbol: "m³",
        unitFamily: "volume" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 1000000,
        calculationLogic: "1 m³ = 1,000,000 ml (1,000 L)",
    },

    // Count Units
    {
        name: "Unit",
        symbol: "unit",
        unitFamily: "count" as UnitFamilyType,
        isBaseUnit: true,
        conversionFactorToBase: 1,
        calculationLogic:
            "The base unit for discrete items (e.g., eggs, pieces).",
    },
    {
        name: "Dozen",
        symbol: "dz",
        unitFamily: "count" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 12,
        calculationLogic: "1 dozen = 12 units",
    },
    {
        name: "Gross",
        symbol: "grs",
        unitFamily: "count" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 144,
        calculationLogic: "1 gross = 144 units (12 dozen)",
    },

    // Length Units
    {
        name: "Meter",
        symbol: "m",
        unitFamily: "length" as UnitFamilyType,
        isBaseUnit: true,
        conversionFactorToBase: 1,
        calculationLogic: "The base unit for all length calculations.",
    },
    {
        name: "Centimeter",
        symbol: "cm",
        unitFamily: "length" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 0.01,
        calculationLogic: "1 cm = 0.01 m",
    },
    {
        name: "Kilometer",
        symbol: "km",
        unitFamily: "length" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 1000,
        calculationLogic: "1 km = 1000 m",
    },
];

const seedUnitsOfMeasurement = async () => {
    try {
        console.log("-> Seeding Units of Measurement...");

        // Perform the Upsert operation
        const result = await db
            .insert(unitOfMeasurement)
            .values(unitsSeedData)
            .onConflictDoUpdate({
                // Use the unique index on the 'symbol' column to detect conflicts
                target: unitOfMeasurement.symbol,

                // Define which columns to update if a conflict is detected.
                // We update all other fields that might change (name, family, factors).
                set: {
                    name: sql`excluded
                    .
                    name`, // Update with the incoming value
                    unitFamily: sql`excluded
                    .
                    "unitFamily"`, // Update with the incoming value
                    isBaseUnit: sql`excluded
                    .
                    "isBaseUnit"`, // Update with the incoming value
                    conversionFactorToBase: sql`excluded
                    .
                    "conversionFactorToBase"`, // Update with the incoming value
                    calculationLogic: sql`excluded
                    .
                    "calculationLogic"`, // Update with the incoming value
                },
            })
            .returning();

        console.log(
            `✅ Successfully processed ${result.length} unit of measurement records (Inserted/Updated).`,
        );
    } catch (error) {
        console.error("Error in seedUnitsOfMeasurement:", error);
        throw error; // rethrow to be caught by the main seed function
    }
};

const runSeed = async () => {
    console.log("🌱 Starting seed...");
    try {
        // Run the new unit seeding function
        await seedUnitsOfMeasurement();

        // If you still need a seed admin for local development, you could re-introduce it here:
        // await createSeedAdmin();

        console.log("✅ Seed successful!");
    } catch (error) {
        console.error("❌ Seed failed", error);
        process.exit(1);
    } finally {
        await pool.end(); // properly close the pool
        console.log("🔌 Pool ended.");
    }
};

// The main function structure remains the same for robust execution
const seed = async () => {
    const client = await pool.connect();
    await runSeed();
    client.release(true);
};

seed()
    .then(() => console.log("Seed process finished."))
    .catch((e) => console.error(e));
