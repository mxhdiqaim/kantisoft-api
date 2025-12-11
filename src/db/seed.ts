import {
    InsertUnitOfMeasurementSchemaT,
    UnitFamilyType,
    unitOfMeasurement,
} from "../schema/unit-of-measurement-schema";
import db, { pool } from "./index";

const unitsSeedData: InsertUnitOfMeasurementSchemaT[] = [
    {
        name: "Gram",
        symbol: "g",
        unitFamily: "weight" as UnitFamilyType,
        isBaseUnit: true,
        conversionFactorToBase: 1,
    },
    {
        name: "Kilogram",
        symbol: "kg",
        unitFamily: "weight" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 1000,
    },
    {
        name: "Milligram",
        symbol: "mg",
        unitFamily: "weight" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 0.001,
    },
    {
        name: "Milliliter",
        symbol: "ml",
        unitFamily: "volume" as UnitFamilyType,
        isBaseUnit: true,
        conversionFactorToBase: 1,
    },
    {
        name: "Liter",
        symbol: "L",
        unitFamily: "volume" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 1000,
    },
    {
        name: "Unit",
        symbol: "unit",
        unitFamily: "count" as UnitFamilyType,
        isBaseUnit: true,
        conversionFactorToBase: 1,
    },
    {
        name: "Dozen",
        symbol: "dz",
        unitFamily: "count" as UnitFamilyType,
        isBaseUnit: false,
        conversionFactorToBase: 12,
    },
];

const seedUnitsOfMeasurement = async () => {
    try {
        console.log("-> Seeding Units of Measurement...");

        // Use onConflictDoNothing() to prevent errors if the script is run multiple times,
        // and data with unique constraints (like 'symbol' or 'name') already exists.
        const result = await db
            .insert(unitOfMeasurement)
            .values(unitsSeedData)
            .onConflictDoNothing()
            .returning();

        if (result.length > 0) {
            console.log(`✅ Successfully inserted ${result.length} new units.`);
        } else {
            console.log(
                "ℹ️ Units already exist in the database. Skipping insertion.",
            );
        }
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
