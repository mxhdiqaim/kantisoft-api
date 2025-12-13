/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { CustomRequest } from "../types/express";
import { handleError2 } from "../service/error-handling";
import { StatusCodes } from "http-status-codes";
import db from "../db";
import {and, eq, sql} from 'drizzle-orm';
import {rawMaterialInventory} from "../schema/raw-materials-schema/raw-material-inventory-schema";
import {rawMaterials} from "../schema/raw-materials-schema";
import {unitOfMeasurement} from "../schema/unit-of-measurement-schema";
import {UnitConversionService} from "../service/unit-conversion-service";


/**
 * @description Retrieves the current stock level for a Raw Material in a specific Store.
 * @route GET /api/v1/raw-material-inventory/:id
 * @access Admin, Manager, Staff
 */
export const getCurrentRawMaterialStock = async (req: CustomRequest, res: Response) => {
    const currentUser = req.user?.data;
    const storeId = currentUser?.storeId;
    const { id: rawMaterialId } = req.params;

    if (!storeId) {
        return handleError2(
            res,
            'User does not have an associated store.',
            StatusCodes.BAD_REQUEST
        );
    }
    if (!rawMaterialId) {
        return handleError2(res, 'Missing Raw Material.', StatusCodes.BAD_REQUEST);
    }

    try {
        // Multi-Join Query
        // Join Inventory -> RawMaterial -> UnitOfMeasurement
        const [stockRecord] = await db.select({
            // Inventory Fields
            inventoryId: rawMaterialInventory.id,
            rawMaterialId: rawMaterialInventory.rawMaterialId,
            storeId: rawMaterialInventory.storeId,
            quantityBase: rawMaterialInventory.quantity, // Stored in Base Unit (g, ml)
            minStockLevelBase: rawMaterialInventory.minStockLevel, // Stored in Base Unit
            status: rawMaterialInventory.status,

            // Raw Material Fields
            rawMaterialName: rawMaterials.name,
            latestUnitPriceBase: rawMaterials.latestUnitPrice, // Price per Base Unit

            // Unit Fields (needed for conversion)
            unitOfMeasurement: {
                id: unitOfMeasurement.id,
                name: unitOfMeasurement.name,
                symbol: unitOfMeasurement.symbol,
                conversionFactorToBase: unitOfMeasurement.conversionFactorToBase,
            }
        })
            .from(rawMaterialInventory)
            .innerJoin(
                rawMaterials,
                eq(rawMaterialInventory.rawMaterialId, rawMaterials.id)
            )
            .innerJoin( // Use inner join here because inventory shouldn't exist without a raw material
                unitOfMeasurement,
                eq(rawMaterials.unitOfMeasurementId, unitOfMeasurement.id)
            )
            .where(and(
                eq(rawMaterialInventory.rawMaterialId, rawMaterialId),
                eq(rawMaterialInventory.storeId, storeId)
            ))
            .limit(1)
            .execute();

        if (!stockRecord) {
            return handleError2(
                res,
                `Inventory record for the Raw Material not found in this store.`,
                StatusCodes.NOT_FOUND
            );
        }

        // Post-Processing and Conversion

        // Calculate Quantity in Presentation Unit (e.g. convert grams to Kilograms)
        // Note: The service's 'convertToBaseUnit' is designed for the opposite direction (Presentation -> Base).
        // We need the inverse: Base -> Presentation.
        // Formula: Quantity_Presentation = Quantity_Base / ConversionFactorToBase

        const conversionFactor = stockRecord.unitOfMeasurement.conversionFactorToBase;

        // a. Current Quantity Conversion
        const quantityPresentation = stockRecord.quantityBase / conversionFactor;

        // b. Min Stock Level Conversion
        const minStockLevelPresentation = stockRecord.minStockLevelBase / conversionFactor;

        // c. Price Conversion (for display)
        const latestUnitPricePresentation = UnitConversionService.displayPriceInPresentationUnit(
            stockRecord.latestUnitPriceBase,
            stockRecord.unitOfMeasurement
        );

        // Format Response
        return res.status(StatusCodes.OK).json({
            inventoryId: stockRecord.inventoryId,
            rawMaterialId: stockRecord.rawMaterialId,
            rawMaterialName: stockRecord.rawMaterialName,

            // Displayed Stock Data
            quantityPresentation: quantityPresentation, // The amount the user understands (e.g., 50 kg)
            minStockLevelPresentation: minStockLevelPresentation,
            unitOfMeasurement: stockRecord.unitOfMeasurement,
            status: stockRecord.status,

            // Price Data
            latestUnitPricePresentation: latestUnitPricePresentation,

            // Internal Data (Optional for API, but good for context)
            quantityBase: stockRecord.quantityBase,
            minStockLevelBase: stockRecord.minStockLevelBase,
        });

    } catch (error: any) {
        return handleError2(
            res,
            'A server error occurred while fetching the raw material stock.',
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined
        );
    }
};

/**
 * @description Creates the initial inventory record for a Raw Material in a Store,
 * or updates the minStockLevel if the record already exists (UPSERT).
 * @route POST /api/v1/raw-material-inventory/create
 * @access Admin, Manager
 * @body { rawMaterialId: string, minStockLevel: number }
 */
export const createRawMaterialInventoryRecord = async (req: CustomRequest, res: Response) => {
    const currentUser = req.user?.data;
    const storeId = currentUser?.storeId;

    if (!storeId) {
        return handleError2(
            res,
            'User does not have an associated store.',
            StatusCodes.BAD_REQUEST
        );
    }

    const { rawMaterialId, minStockLevel } = req.body;

    // We assume minStockLevel is mandatory for setting up inventory tracking
    if (!rawMaterialId || minStockLevel === undefined || typeof minStockLevel !== 'number' || minStockLevel < 0) {
        return handleError2(res, 'Raw Material and minStockLevel and it must be equal to or greater 0', StatusCodes.BAD_REQUEST);
    }

    try {
        // Data to insert or update
        const inventoryData = {
            rawMaterialId: rawMaterialId,
            storeId: storeId,
            minStockLevel: minStockLevel,
            // quantity defaults to 0, status defaults to 'inStock'
        };

        const [inventoryRecord] = await db.insert(rawMaterialInventory)
            .values(inventoryData)
            .onConflictDoUpdate({
                // Target the unique index combining rawMaterialId and storeId
                target: [rawMaterialInventory.rawMaterialId, rawMaterialInventory.storeId],

                // If conflicted, only update the minStockLevel
                set: {
                    minStockLevel: sql`excluded."minStockLevel"`,
                },
            })
            .returning();

        // --- 2. Determine Action and Return Success ---
        // (We can't easily tell if it was an insert or update from Drizzle's result array,
        // so we use a generic success message focusing on the outcome)

        return res.status(StatusCodes.CREATED).json(inventoryRecord);

    } catch (error: any) {
        // Handle cases where the rawMaterialId or storeId doesn't exist (foreign key constraint)
        if (error.code === '23503') {
            return handleError2(
                res,
                'Invalid Raw Material ID or Store ID.',
                StatusCodes.NOT_FOUND,
                error instanceof Error ? error : undefined
            );
        }

        return handleError2(
            res,
            'A server error occurred during inventory setup.',
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined
        );
    }
};