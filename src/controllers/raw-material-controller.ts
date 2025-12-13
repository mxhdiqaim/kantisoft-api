/* eslint-disable @typescript-eslint/no-explicit-any */
import {Response} from 'express';
import { InsertRawMaterialSchemaT, rawMaterials } from "../schema/raw-materials-schema";
import {CustomRequest} from "../types/express";
import {handleError2} from "../service/error-handling";
import {StatusCodes} from "http-status-codes";
import db from "../db";
import { UnitConversionService } from "../service/unit-conversion-service";
import { unitOfMeasurement } from "../schema/unit-of-measurement-schema";
import { and, eq } from "drizzle-orm";
import { RawMaterialStatusEnum } from "../types/enums";


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
            .where(eq(rawMaterials.status, RawMaterialStatusEnum.ACTIVE))
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
 * @description Retrieves a single Raw Material record by ID.
 * @route GET /api/v1/raw-materials/:id
 * @access Admin, Manager
 */
export const getSingleRawMaterial = async (req: CustomRequest, res: Response) => {
    const currentUser = req.user?.data;
    const storeId = currentUser?.storeId;
    const { id: rawMaterialId } = req.params;

    if (!storeId) {
        return handleError2(
            res,
            'User does not have an associated store.',
            StatusCodes.BAD_REQUEST
        )
    }

    // Basic ID Validation
    if (!rawMaterialId) {
        return handleError2(
            res,
            'Missing Raw Material ID in request path.',
            StatusCodes.BAD_REQUEST
        );
    }

    try {
        // We select the necessary fields and join with the unit of the measurement table.
        const [rawMaterialItem] = await db.select({
            id: rawMaterials.id,
            name: rawMaterials.name,
            description: rawMaterials.description,
            latestUnitPriceBase: rawMaterials.latestUnitPrice,
            createdAt: rawMaterials.createdAt,
            lastModified: rawMaterials.lastModified,

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
            .where(and(
                eq(rawMaterials.id, rawMaterialId),
                eq(rawMaterials.status, RawMaterialStatusEnum.ACTIVE)
            ))
            .limit(1)
            .execute();

        if (!rawMaterialItem) {
            return handleError2(
                res,
                `Raw Material not found.`,
                StatusCodes.NOT_FOUND
            );
        }

        // Ensure unit data exists before attempting conversion
        if (!rawMaterialItem.unitOfMeasurement) {
            // This case should not happen if onDelete: "restrict" is working, but it's safe to check.
            return handleError2(
                res,
                `Raw Material's unit of measurement data is missing.`,
                StatusCodes.INTERNAL_SERVER_ERROR
            );
        }

        // Calculate the price per Presentation Unit using the service's inverse logic
        const latestUnitPricePresentation = UnitConversionService.displayPriceInPresentationUnit(
            rawMaterialItem.latestUnitPriceBase,
            rawMaterialItem.unitOfMeasurement
        );

        const formattedResponse = {
            id: rawMaterialItem.id,
            name: rawMaterialItem.name,
            description: rawMaterialItem.description,

            // Price the user provided and expects to see for this unit
            latestUnitPricePresentation: latestUnitPricePresentation,

            // Unit information
            unitOfMeasurement: rawMaterialItem.unitOfMeasurement,

            // Internal Base Price (useful for internal logic, but maybe hidden from most users)
            latestUnitPriceBase: rawMaterialItem.latestUnitPriceBase,

            createdAt: rawMaterialItem.createdAt,
            lastModified: rawMaterialItem.lastModified,
        };

        return res.status(StatusCodes.OK).json(formattedResponse);

    } catch (error: any) {
        return handleError2(
            res,
            'A server error occurred while fetching the raw material.',
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
        const [result] = await db.insert(rawMaterials)
            .values(newRawMaterialData)
            .returning();

        return res.status(StatusCodes.CREATED).json(result);

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

/**
 * @description Updates an existing Raw Material record by ID.
 * @route PATCH /api/v1/raw-materials/:id
 * @access Admin, Manager
 */
export const updateRawMaterial = async (req: CustomRequest, res: Response) => {
    const currentUser = req.user?.data;
    const storeId = currentUser?.storeId;
    const { id: rawMaterialId } = req.params;

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
        unitOfMeasurementId,
        latestUnitPricePresentation
    } = req.body;

    if (!rawMaterialId) {
        return handleError2(res, 'Something went wrong!', StatusCodes.BAD_REQUEST);
    }

    try {
        const existingMaterial = await db.query.rawMaterials.findFirst({
            where: eq(rawMaterials.id, rawMaterialId),
            with: {
                unitOfMeasurement: true // Fetch the current unit for comparison
            }
        });

        if (!existingMaterial) {
            return handleError2(res, `Raw material not found.`, StatusCodes.NOT_FOUND);
        }

        const updatePayload: Partial<typeof existingMaterial> = {};

        // Update basic text fields if provided
        if (name !== undefined) updatePayload.name = name;
        if (description !== undefined) updatePayload.description = description;


        // Determine the unit ID to use for fetching the conversion factor.
        const targetUnitOfMeasurementId = unitOfMeasurementId || existingMaterial.unitOfMeasurementId;

        let finalBasePrice: number | undefined = undefined;
        let finalUnitOfMeasurementRecord;

        // Only proceed with unit of measurement/price logic if either the unit OR the price is changing.
        if (unitOfMeasurementId || latestUnitPricePresentation !== undefined) {

            // Fetch the unit record (either old or new)
            finalUnitOfMeasurementRecord = await UnitConversionService.fetchUnitById(targetUnitOfMeasurementId);

            if (!finalUnitOfMeasurementRecord) {
                return handleError2(res, `Unit of Measurement not found.`, StatusCodes.NOT_FOUND);
            }

            // Calculate the new Base Price
            // If the user provided a NEW price, use it for conversion.
            if (latestUnitPricePresentation !== undefined) {
                // Calculation: Price_Base = Price_Presentation / ConversionFactorToBase
                finalBasePrice = UnitConversionService.calculateBasePrice(
                    latestUnitPricePresentation,
                    finalUnitOfMeasurementRecord
                );
            } else {
                // If NO new price was provided, but the unit changed,
                // we must re-calculate the Base Price using the OLD Base Price
                // and the NEW unit's factor. This is a complex scenario,
                // but for simplicity here, we assume if the unit changes,
                // the user must provide the price for the new unit.
                // For this MVP, let's enforce: If the unit changes, the price must be provided.
                if (unitOfMeasurementId && unitOfMeasurementId !== existingMaterial.unitOfMeasurementId) {
                    return handleError2(res, 'If changing the Unit of Measurement, you must provide a new latestUnitPricePresentation for the new unit.', StatusCodes.BAD_REQUEST);
                }
            }

            // Apply updates to the payload
            if (unitOfMeasurementId) updatePayload.unitOfMeasurementId = unitOfMeasurementId;
            if (finalBasePrice !== undefined) updatePayload.latestUnitPrice = finalBasePrice;
        }

        if (Object.keys(updatePayload).length === 0) {
            return res.status(StatusCodes.OK).json({ success: true, message: 'No fields provided for update.' });
        }

        const updatedResult = await db.update(rawMaterials)
            .set(updatePayload)
            .where(eq(rawMaterials.id, rawMaterialId))
            .returning();

        if (updatedResult.length === 0) {
            return handleError2(res, 'Update failed or raw material not found.', StatusCodes.INTERNAL_SERVER_ERROR);
        }

        const [updatedItem] = updatedResult;

        // Fetch the unit used for display (could be the old one or the newly provided one)
        const unitForDisplay = finalUnitOfMeasurementRecord || existingMaterial.unitOfMeasurement;

        const priceForDisplay = latestUnitPricePresentation !== undefined
            ? latestUnitPricePresentation
            : UnitConversionService.displayPriceInPresentationUnit(updatedItem.latestUnitPrice, unitForDisplay);


        return res.status(StatusCodes.OK).json({
            ...updatedItem,
            latestUnitPricePresentation: priceForDisplay, // The formatted price
            unit: unitForDisplay // Include unit details
        });

    } catch (error: any) {
        // Handle unique constraint violation (Raw Material Name must be unique)
        if (error.code === '23505') {
            return handleError2(res, 'A raw material with this name already exists.', StatusCodes.CONFLICT, error instanceof Error ? error : undefined);
        }

        return handleError2(res, 'A server error occurred during the update.', StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};

/**
 * @description Soft deletes (archives) a single Raw Material record by ID.
 * @route DELETE /api/v1/raw-materials/:id
 * @access Admin, Manager
 */
export const deleteRawMaterial = async (req: CustomRequest, res: Response) => {
    const currentUser = req.user?.data;
    const storeId = currentUser?.storeId;
    const { id: rawMaterialId } = req.params;

    if (!storeId) {
        return handleError2(
            res,
            'User does not have an associated store.',
            StatusCodes.BAD_REQUEST
        )
    }

    if (!rawMaterialId) {
        return handleError2(res, 'Missing Raw Material', StatusCodes.BAD_REQUEST);
    }

    try {
        const [result] = await db.update(rawMaterials)
            .set({
                status: RawMaterialStatusEnum.DELETED, // Set the status to 'deleted'
            })
            .where(eq(rawMaterials.id, rawMaterialId))
            .returning({ id: rawMaterials.id, name: rawMaterials.name, status: rawMaterials.status }); // Return only key confirmation fields

        if (!result) {
            return handleError2(
                res,
                `Raw material not found.`,
                StatusCodes.NOT_FOUND
            );
        }

        return res.status(StatusCodes.OK).json(result);

    } catch (error: any) {
        // This is important: if other tables (like inventory or recipes) have a
        // FOREIGN KEY constraint that prevents setting status to 'archived', you will get a PostgreSQL error here.
        // Assuming your foreign keys allow the update of a simple status field,
        // the generic catch block handles other internal errors.

        return handleError2(
            res,
            'A server error occurred during the archive operation.',
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined
        );
    }
};
