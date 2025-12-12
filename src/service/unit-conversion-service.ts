import {unitOfMeasurement, UnitOfMeasurementSchemaT,} from "../schema/unit-of-measurement-schema";
import db from "../db";
import {eq} from "drizzle-orm";

/**
 * Utility class for handling all unit conversion logic.
 */
export const UnitConversionService = {
    /**
     * Retrieves a unit record from the database by its ID.
     * @param unitOfMeasurementId The UUID of the unit to fetch.
     * @returns The UnitOfMeasurementSchemaT object or null if not found.
     */
    async fetchUnitById(
        unitOfMeasurementId: string,
    ): Promise<UnitOfMeasurementSchemaT | undefined> {
        return db.query.unitOfMeasurement.findFirst({
            where: eq(unitOfMeasurement.id, unitOfMeasurementId),
        });
    },

    /**
     * Converts a quantity from a source unit's presentation to the system's Base Unit.
     * This is used when storing inventory or price data.
     * * Formula: Quantity_Base = Quantity_Presentation * ConversionFactorToBase
     * * @param quantity The amount in the source unit (e.g. 5 for 5 kg).
     * @param sourceUnit The unit object (must contain conversionFactorToBase).
     * @returns The converted quantity in the base unit (e.g. 5000 for 5000 g).
     */
    convertToBaseUnit(
        quantity: number,
        sourceUnit: Pick<UnitOfMeasurementSchemaT, "conversionFactorToBase">,
    ): number {
        if (sourceUnit.conversionFactorToBase <= 0) {
            throw new Error("Conversion factor must be positive and non-zero.");
        }

        // Example: 5 (kg) * 1000 (factor) = 5000 (g)
        return quantity * sourceUnit.conversionFactorToBase;
    },

    /**
     * Calculates the cost per Base Unit from the cost per Presentation Unit.
     * Formula: Price_Base = Price_Presentation / ConversionFactorToBase
     */
    calculateBasePrice(
        pricePerPresentationUnit: number,
        sourceUnit: Pick<UnitOfMeasurementSchemaT, "conversionFactorToBase">,
    ): number {
        if (sourceUnit.conversionFactorToBase <= 0) {
            throw new Error("Conversion factor must be positive and non-zero.");
        }
        // CRITICAL LOGIC for raw material creation: division to get price per the smallest unit
        return pricePerPresentationUnit / sourceUnit.conversionFactorToBase;
    },

    // Add the inverse logic for displaying prices later:
    displayPriceInPresentationUnit(
        pricePerBaseUnit: number,
        targetUnit: Pick<UnitOfMeasurementSchemaT, "conversionFactorToBase">,
    ): number {
        if (targetUnit.conversionFactorToBase <= 0) {
            throw new Error("Conversion factor must be positive and non-zero.");
        }
        // Example: $0.005 (per g) * 1000 (factor) = $5.00 (per kg)
        return pricePerBaseUnit * targetUnit.conversionFactorToBase;
    },

    /**
     * Converts a price from a Base Unit cost to the Presentation Unit cost.
     * This is used when calculating the price to display to the user.
     * * Formula: Price_Presentation = Price_Base * ConversionFactorToBase
     * * @param pricePerBaseUnit The price per base unit (e.g. $0.005 per gram).
     * @param targetUnit The unit object (must contain conversionFactorToBase).
     * @returns The price per presentation unit (e.g. N5000 per kg).
     */
    convertPriceToBaseUnit(
        pricePerBaseUnit: number,
        targetUnit: Pick<UnitOfMeasurementSchemaT, "conversionFactorToBase">,
    ): number {
        if (targetUnit.conversionFactorToBase <= 0) {
            throw new Error("Conversion factor must be positive and non-zero.");
        }

        // Example: 50 (per g) * 1000 (factor) = N5000 (per kg)
        return pricePerBaseUnit * targetUnit.conversionFactorToBase;
    },
};
