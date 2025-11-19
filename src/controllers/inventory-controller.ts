
import { and, desc, eq } from "drizzle-orm";
import { Response } from "express";
import db from "../db";
import { inventory } from "../schema/inventory-schema";
import { handleError2} from "../service/error-handling";
import { CustomRequest } from "../types/express";
import { logActivity } from "../service/activity-logger";
import {getInventoryByMenuItemId} from "../helpers";
import {StatusCodes} from "http-status-codes";
import {inventoryTransactions} from "../schema/inventory-schema/inventory-transaction-schema";
import { getStockAdjustedAction } from "../utils/inventory-utils";


/**
 * @desc    Get all inventory records for the user's store
 * @route   GET /api/v1/inventory/
 * @access  Private (Store-associated users only)
 */
export const getAllInventory = async (req: CustomRequest, res: Response) => {
    try {
        const userStoreId = req.userStoreId;

        if (!userStoreId) {
            return handleError2(
                res,
                "You must be associated with a store to view inventory.",
                StatusCodes.FORBIDDEN,
            );
        }

        const allInventory = await db.query.inventory.findMany({
            where: eq(inventory.storeId, userStoreId),
            orderBy: [desc(inventory.lastModified)],
            with: {
                menuItem: { columns: { name: true, itemCode: true } },
                store: { columns: { name: true } },
            },
        });

        res.status(StatusCodes.OK).json(allInventory);
    } catch (error) {
        // console.error(error);
        handleError2(
            res,
            "Problem loading inventory data, please try again",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Get a single inventory record by Menu Item ID
 * @route   GET /api/v1/inventory/:menuItemId
 * @access  Private (Store-associated users only)
 */
export const getInventoryByMenuItem = async (
    req: CustomRequest,
    res: Response,
) => {
    try {
        const { menuItemId } = req.params;
        const userStoreId = req.userStoreId;

        if (!userStoreId) {
            return handleError2(
                res,
                "You must be associated with a store to view inventory.",
                StatusCodes.FORBIDDEN,
            );
        }

        const inventoryItem = await getInventoryByMenuItemId(
            menuItemId,
            userStoreId,
        );

        if (!inventoryItem) {
            return handleError2(
                res,
                "Inventory record not found for this menu item.",
                StatusCodes.NOT_FOUND,
            );
        }

        res.status(StatusCodes.OK).json(inventoryItem);
    } catch (error) {
        // console.error(error);
        return handleError2(
            res,
            "Problem loading inventory item, please try again",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/*
 * @desc Create an inventory record for a menu item
 * @route POST /api/v1/inventory/
 * @access Private (Store-associated users only)
 */
export const createInventoryRecord = async (
    req: CustomRequest,
    res: Response,
) => {
    try {
        const { menuItemId, quantity, minStockLevel } = req.body;
        const userStoreId = req.userStoreId!;

        // Validation and Existence Checks
        if (!menuItemId || quantity === undefined) {
            return handleError2(
                res,
                "Menu item ID and initial quantity are required.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const existingInventory = await getInventoryByMenuItemId(
            menuItemId,
            userStoreId,
        );

        if (existingInventory) {
            return handleError2(
                res,
                "Inventory record already exists for this menu item in your store.",
                StatusCodes.CONFLICT,
            );
        }

        // TODO: (Future) Verify that the menuItemId actually exists in the menuItems table

        // Insert new Inventory record
        const [newInventory] = await db
            .insert(inventory)
            .values({
                menuItemId,
                storeId: userStoreId,
                quantity: quantity,
                minStockLevel: minStockLevel,
                // status will be set based on minStockLevel logic
            })
            .returning();

        // Log initial stock transaction
        await db.insert(inventoryTransactions).values({
            menuItemId,
            storeId: userStoreId,
            transactionType: "adjustmentIn", // Treat initial setting as an adjustment in
            quantityChange: quantity,
            resultingQuantity: quantity,
            performedBy: req.user?.data.id,
            notes: "Initial inventory setup.",
        });

        // Log activity
        await logActivity({
            userId: req.user?.data.id,
            storeId: userStoreId,
            action: "INVENTORY_RECORD_CREATED",
            entityId: newInventory.id,
            entityType: "inventory",
            details: `Initial inventory record created for Menu Item ${menuItemId} with quantity ${newInventory.quantity}.`,
        });

        res.status(StatusCodes.CREATED).json(newInventory);
    } catch (error) {
        // console.error(error);
        handleError2(
            res,
            "Problem creating inventory record, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/*
    * @desc    Adjust stock level for a menu item (manual adjustment)
    * @route   PATCH /api/v1/inventory/adjust-stock/:menuItemId
    * @access  Private (Store-associated users only)
    * @body    { quantityAdjustment: number, transactionType: string, notes?: string }
    *          quantityAdjustment: positive or negative number indicating the change
    *          transactionType: one of 'adjustmentIn', 'adjustmentOut', 'purchaseReceive'
    *          notes: optional reason for adjustment
 */
export const adjustStock = async (req: CustomRequest, res: Response) => {
    try {
        const { menuItemId } = req.params;
        const { quantityAdjustment, transactionType, notes } = req.body; // quantityAdjustment is the delta (+ or -)
        const userStoreId = req.userStoreId!;
        const userId = req.user?.data.id;

        // Validation
        if (quantityAdjustment === undefined || !transactionType) {
            return handleError2(
                res,
                "Quantity adjustment amount and transaction type are required.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const changeAmount = Number(quantityAdjustment);
        if (isNaN(changeAmount) || changeAmount === 0) {
            return handleError2(
                res,
                "Quantity adjustment must be a non-zero number.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const validAdjustmentTypes = [
            "adjustmentIn",
            "adjustmentOut",
            "purchaseReceive",
        ];

        // Types allowed for manual change via API
        if (!validAdjustmentTypes.includes(transactionType)) {
            return handleError2(
                res,
                `Invalid transaction type for manual adjustment.`,
                // `Invalid transaction type for manual adjustment. Must be one of: ${validAdjustmentTypes.join(", ")}.`,
                StatusCodes.BAD_REQUEST,
            );
        }

        // Fetch current inventory
        const currentInventory = await getInventoryByMenuItemId(
            menuItemId,
            userStoreId,
        );

        if (!currentInventory) {
            return handleError2(
                res,
                "Inventory record not found. Create a record first.",
                StatusCodes.NOT_FOUND,
            );
        }

        // Calculate new quantity
        const currentQuantity = currentInventory.quantity;
        const newQuantity = currentQuantity + changeAmount;

        if (newQuantity < 0) {
            return handleError2(
                res,
                "Cannot adjust stock to a negative quantity. Check your current stock and adjustment amount.",
                StatusCodes.BAD_REQUEST,
            );
        }

        // Update the Inventory table and log the Transaction (within a transaction block for safety)
        const [updatedInventory] = await db.transaction(async (tx) => {

            //  Update the Inventory record
            await tx
                .update(inventory)
                .set({
                    quantity: newQuantity,
                    lastModified: new Date(),
                    lastCountDate: new Date(),
                    // TODO: (Future) Add logic here to update 'status' based on 'newQuantity' vs 'minStockLevel'
                })
                .where(
                    and(
                        eq(inventory.menuItemId, menuItemId),
                        eq(inventory.storeId, userStoreId),
                    ),
                );

            // Insert the Inventory Transaction record
            return tx
                .insert(inventoryTransactions)
                .values({
                    menuItemId,
                    storeId: userStoreId,
                    transactionType,
                    quantityChange: changeAmount,
                    resultingQuantity: newQuantity,
                    performedBy: userId,
                    notes: notes,
                    transactionDate: new Date(),
                })
                .returning({ id: inventoryTransactions.id });

            // return updated;
        });

        // 5. Log activity
        await logActivity({
            userId: userId,
            storeId: userStoreId,
            // action: `STOCK_ADJUSTED_${transactionType.toUpperCase()}`,
            action: getStockAdjustedAction(transactionType),
            entityId: updatedInventory.id,
            entityType: "inventory",
            details: `Stock for Menu Item ${menuItemId} adjusted by ${changeAmount}. New quantity: ${newQuantity}.`,
        });

        res.status(StatusCodes.OK).json(updatedInventory);

    } catch (error) {
        // console.error(error);
        handleError2(
            res,
            "Problem adjusting stock level, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};