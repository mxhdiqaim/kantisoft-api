/* eslint-disable @typescript-eslint/no-explicit-any */
import {Response} from 'express';
import {InsertRawMaterialSchemaT, rawMaterials} from '../schema/raw-materials-schema';
import {CustomRequest} from "../types/express";
import {handleError2} from "../service/error-handling";
import {StatusCodes} from "http-status-codes";
import db from "../db";
import { UnitConversionService } from "../service/unit-conversion-service";
import { unitOfMeasurement } from "../schema/unit-of-measurement-schema";
import { eq } from "drizzle-orm";


/**
 * @description Retrieves a list of all Raw Materials, including their presentation unit data.
 * @route GET /api/v1/raw-materials
 * @access Admin, Manager
 */
export const getAllRawMaterial = async (req: CustomRequest, res: Response) => {
    const currentUser = req.user?.data;
    const storeId = currentUser?.storeId;

    if (!storeId) {
        return handleError2(
            res,
            'User does not have an associated store.',
            StatusCodes.BAD_REQUEST
        )
    }

    try {
        // We join rawMaterials with unitOfMeasurement to get the presentation unit details needed for the display conversion.
        const results = await db.select({
            id: rawMaterials.id,
            name: rawMaterials.name,
            description: rawMaterials.description,
            latestUnitPriceBase: rawMaterials.latestUnitPrice, // Price per g/ml/unit (the stored value)
            createdAt: rawMaterials.createdAt,

            // Joined Unit Fields
            unitOfMeasurement: {
                id: unitOfMeasurement.id,
                name: unitOfMeasurement.name,
                symbol: unitOfMeasurement.symbol,
                conversionFactorToBase: unitOfMeasurement.conversionFactorToBase,
            }
        })
            .from(rawMaterials)
            .leftJoin(
                unitOfMeasurement,
                eq(rawMaterials.unitOfMeasurementId, unitOfMeasurement.id)
            )
            .execute();

        // Iterate through results to convert the stored Base Price back to the
        // Presentation Price that the user expects to see (e.g. price per Kilogram).
        const rawMaterialsWithPresentationPrice = results.map(item => {

            // Handle case where unit of measurement might not be found
            if (!item.unitOfMeasurement) {
                return {
                    ...item,
                    latestUnitPricePresentation: 0,
                    unitOfMeasurement: null,
                };
            }

            // Calculate the price per Presentation Unit using the service's inverse logic
            const latestUnitPricePresentation = UnitConversionService.displayPriceInPresentationUnit(
                item.latestUnitPriceBase,
                item.unitOfMeasurement
            );

            // Structure the data for the API response
            return {
                id: item.id,
                name: item.name,
                description: item.description,

                // Price the user provided and expects to see for this unit
                latestUnitPricePresentation: latestUnitPricePresentation,

                // Unit information
                unitOfMeasurement: item.unitOfMeasurement,

                // Internal Base Price (optional but useful for debugging)
                latestUnitPriceBase: item.latestUnitPriceBase,

                createdAt: item.createdAt,
            };
        });

        return res.status(StatusCodes.OK).json({
            count: rawMaterialsWithPresentationPrice.length,
            data: rawMaterialsWithPresentationPrice,
        });

    } catch (error: any) {
        return handleError2(
            res,
            'A server error occurred while fetching raw materials.',
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined
        );
    }
}

/**
 * @description Creates a new Raw Material record.
 * @route POST /api/v1/raw-materials
 * @access Admin, Manager
 */
export const createRawMaterial = async (req: CustomRequest, res: Response) => {

    const currentUser = req.user?.data;
    const storeId = currentUser?.storeId;

    if (!storeId) {
        return handleError2(
            res,
            'User does not have an associated store.',
            StatusCodes.BAD_REQUEST
        )
    }

    const {
        name,
        description,
        unitOfMeasurementId, // The ID of the presentation unit (e.g. Kilogram's ID)
        latestUnitPricePresentation // The price per presentation unit (e.g. N500/kg)
    } = req.body;

    // Basic Input Validation
    if (!name || !unitOfMeasurementId || latestUnitPricePresentation === undefined) {
        return handleError2(
            res,
            "Missing required fields: name, unitOfMeasurementId, or latestUnitPricePresentation.",
            StatusCodes.BAD_REQUEST
        )
    }

    try {
        // Look up the Unit and its Conversion Factor
        const unitRecord = await UnitConversionService.fetchUnitById(unitOfMeasurementId);

        if (!unitRecord) {
            return handleError2(
                res,
                `Unit of Measurement not found.`,
                StatusCodes.NOT_FOUND
            );
        }

        // Base Unit Calculation
        // latestUnitPrice: Cost per Base Unit (e.g. Cost per Gram)
        // Formula: Price / Factor = Cost per Base Unit
        // Example: N10,000 / 10 (kg -> g factor) = N1000 per gram
        const latestUnitPriceBase = latestUnitPricePresentation / unitRecord.conversionFactorToBase;

        // Prepare the data for insertion
        const newRawMaterialData: InsertRawMaterialSchemaT = {
            name,
            description,
            unitOfMeasurementId,
            latestUnitPrice: latestUnitPriceBase, // Store the calculated price per BASE UNIT
        };

        // Insert the new Raw Material
        const result = await db.insert(rawMaterials)
            .values(newRawMaterialData)
            .returning();

        return res.status(StatusCodes.CREATED).json({
            message: 'Raw material created successfully.',
            data: result[0],
        });

    } catch (error: any) {
        // Handle unique constraint violation (Raw Material Name must be unique)
        if (error.code === '23505') {
            return handleError2(
                res,
                'A raw material with this name already exists.',
                StatusCodes.CONFLICT,
                error instanceof Error ? error : undefined
            )
        }

        return handleError2(
            res,
            'A server error occurred while creating the raw material.',
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined
        )
    }
}