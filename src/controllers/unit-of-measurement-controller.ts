import { Response } from 'express';
import { eq } from 'drizzle-orm';
import {CustomRequest} from "../types/express";
import {
    unitFamilyEnum,
    UnitFamilyType,
    unitOfMeasurement,
    UnitOfMeasurementSchemaT
} from "../schema/unit-of-measurement-schema";
import db from "../db";
import {StatusCodes} from "http-status-codes";
import { handleError2 } from "../service/error-handling";

/**
 * @description Retrieves all Units of Measurement, with optional filtering by unit family.
 * @route GET /api/v1/units
 * @access Manager, Admin
 */
export const getAllUnitsOfMeasurement = async (req: CustomRequest, res: Response) =>{
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        // Get an optional 'family' filter from query parameters
        const familyFilter = req.query.family as UnitFamilyType | undefined;

        if (!storeId) {
            return handleError2(
                res,
                "User not associated with any store.",
                StatusCodes.FORBIDDEN,
            );
        }

        let query = db.select().from(unitOfMeasurement).$dynamic(); // Initialize dynamic query

        // Validate and apply the filter condition
        if (familyFilter) {
            // Check if the provided family name is valid against the enum values
            const validFamilies = unitFamilyEnum.enumValues;

            if (!validFamilies.includes(familyFilter)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: `Invalid unit family provided. Must be one of: ${validFamilies.join(', ')}`
                });
            }

            // Apply the filter using the 'eq' helper
            query = query.where(eq(unitOfMeasurement.unitFamily, familyFilter));
        }

        // 3. Execute the final query
        const allUnits: UnitOfMeasurementSchemaT[] = await query.execute();

        // 4. Return the results
        return res.status(StatusCodes.OK).json({
            success: true,
            count: allUnits.length,
            data: allUnits,
        });

    } catch (error) {
        console.error('Error fetching units of measurement:', error);
        return res.status(500).json({
            success: false,
            message: 'A server error occurred while retrieving units.'
        });
    }
}