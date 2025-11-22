// @typescript-eslint/no-explicit-any
import { and, desc, eq, gte, inArray, ne, sql, SQL } from "drizzle-orm";
import { Response } from "express";
import db from "../db";
import { inventory } from "../schema/inventory-schema";
import { handleError2} from "../service/error-handling";
import { CustomRequest } from "../types/express";
import { logActivity } from "../service/activity-logger";
import { calculateInventoryStatus, getInventoryByMenuItemId } from "../helpers";
import {StatusCodes} from "http-status-codes";
import {inventoryTransactions} from "../schema/inventory-schema/inventory-transaction-schema";
import { getStockAdjustedAction } from "../utils/inventory-utils";
import { menuItems } from "../schema/menu-items-schema";
import { OrderItemStockUpdate, Period } from "../types";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { lte } from "drizzle-orm/sql/expressions/conditions";
import { getFilterDates } from "../utils/get-filter-dates";

const TIMEZONE = "Africa/Lagos"; // Define a constant for your target timezone

/**
 * @desc    Get all inventory records for the user's store
 * @route   GET /api/v1/inventory/
 * @access  Private (Store-associated users only)
 */
export const getAllInventory = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to view inventory.",
                StatusCodes.FORBIDDEN,
            );
        }

        const allInventory = await db.query.inventory.findMany({
            where: eq(inventory.storeId, storeId),
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
 * @desc    Get all inventory transaction history for a single menu item
 * @route   GET /api/v1/inventory/transactions/:menuItemId
 * @access  Private (Store-associated users only)
 * @query   ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const getTransactionsByMenuItem = async (
    req: CustomRequest,
    res: Response,
) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store.",
                StatusCodes.FORBIDDEN,
            );
        }

        const { id: menuItemId } = req.params;
        const { startDate, endDate } = req.query;

        // Base condition: Filter by the item ID and the store ID
        let whereClause = and(
            eq(inventoryTransactions.menuItemId, menuItemId),
            eq(inventoryTransactions.storeId, storeId),
        );

        // Optional: Add date range filtering
        if (startDate && endDate) {
            whereClause = and(
                whereClause,
                gte(inventoryTransactions.transactionDate, new Date(startDate as string)),
                lte(inventoryTransactions.transactionDate, new Date(endDate as string)),
            );
        }

        const transactions = await db.query.inventoryTransactions.findMany({
            where: whereClause,
            orderBy: [desc(inventoryTransactions.transactionDate)],
            with: {
                // Fetch related data for context
                performedByUser: { columns: { firstName: true, lastName: true } },
                menuItem: { columns: { name: true, itemCode: true } },
            },
        });

        if (transactions.length === 0) {
            return handleError2(
                res,
                "No transaction history found for this item.",
                StatusCodes.NOT_FOUND,
            );
        }

        res.status(StatusCodes.OK).json(transactions);
    } catch (error) {
        handleError2(
            res,
            "Problem loading transaction history, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};


/**
 * @desc    Get a summary of all inventory movements within a specified period
 * @route   GET /api/v1/inventory/transactions/report
 * @access  Private (Store-associated users only)
 * @query   ?timePeriod=week OR ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const getHistoricalStockReport = async (
    req: CustomRequest,
    res: Response,
) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to view reports.",
                StatusCodes.FORBIDDEN,
            );
        }

        const period = req.query.period as string | undefined;
        const startDate = req.query.startDate as string | undefined;
        const endDate = req.query.endDate as string | undefined;

        // const timePeriod = (req.query.timePeriod as TimePeriod) || undefined;
        const { finalStartDate, finalEndDate, periodUsed } = getFilterDates(
            period as Period | undefined,
            startDate,
            endDate,
            TIMEZONE // Pass the constant timezone
        );

        // Base condition: Filter by the current user's store ID
        let whereClause: SQL | undefined = eq(inventoryTransactions.storeId, storeId);

        // 1. Construct the WHERE clause with a date filter
        if (finalStartDate && finalEndDate) {
            whereClause = and(
                whereClause,
                gte(inventoryTransactions.transactionDate, finalStartDate),
                lte(inventoryTransactions.transactionDate, finalEndDate),
            );
        }

        // Use SQL aggregation to sum the quantityChange grouped by transactionType
        const report = await db
            .select({
                transactionType: inventoryTransactions.transactionType,
                // Sum the quantityChange and ensure it's returned as a numeric type (or string to be parsed later)
                totalQuantityMoved: sql<string>`SUM(${inventoryTransactions.quantityChange})`.as('totalQuantityMoved'),
            })
            .from(inventoryTransactions)
            .where(whereClause)
            .groupBy(inventoryTransactions.transactionType);


        // Format the results for a cleaner response object
        const formattedReport = report.map(item => ({
            type: item.transactionType,
            // Parse the sum string to a float/number
            totalChange: parseFloat(item.totalQuantityMoved || '0'),

            // Helpful label based on the transaction type
            label: item.transactionType === 'sale' ? 'Total Units Sold (Decrease)' :
                item.transactionType === 'adjustmentOut' ? 'Total Loss/Waste (Decrease)' :
                    item.transactionType === 'purchaseReceive' ? 'Total Units Received (Increase)' :
                        item.transactionType === 'adjustmentIn' ? 'Total Units Adjusted In (Increase)' :
                            item.transactionType,
        }));


        res.status(StatusCodes.OK).json({
            periodStart: startDate || 'All Time',
            periodEnd: endDate || 'All Time',
            summary: formattedReport,
            period: periodUsed,
        });

    } catch (error) {
        // console.error(error);
        handleError2(
            res,
            "Problem generating stock report, please try again.",
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
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to view inventory.",
                StatusCodes.FORBIDDEN,
            );
        }

        const { id: menuItemId } = req.params;

        const inventoryItem = await getInventoryByMenuItemId(
            menuItemId,
            storeId,
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
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to view inventory.",
                StatusCodes.FORBIDDEN,
            );
        }

        const { menuItemId, quantity, minStockLevel } = req.body;


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
            storeId,
        );

        if (existingInventory) {
            return handleError2(
                res,
                "Inventory record already exists for this menu item in your store.",
                StatusCodes.CONFLICT,
            );
        }

        const existingMenuItem = await db.query.menuItems.findFirst({
            where: and(
                eq(menuItems.id, menuItemId),
                eq(menuItems.storeId, storeId),
            ),
            columns: { id: true, name: true }, // Only fetch what is needed
        });

        if (!existingMenuItem) {
            return handleError2(
                res,
                `Menu item not found in your store.`,
                StatusCodes.NOT_FOUND,
            );
        }

        // Insert a new Inventory record
        const [newInventory] = await db
            .insert(inventory)
            .values({
                menuItemId,
                storeId: storeId,
                quantity: quantity,
                minStockLevel: minStockLevel,
                // status will be set based on minStockLevel logic
            })
            .returning();

        // Log initial stock transaction
        await db.insert(inventoryTransactions).values({
            menuItemId,
            storeId: storeId,
            transactionType: "adjustmentIn", // Treat the initial setting as an adjustment in
            quantityChange: quantity,
            resultingQuantity: quantity,
            performedBy: currentUser?.id,
            notes: "Initial inventory setup.",
        });

        // Log activity
        await logActivity({
            userId: currentUser?.id,
            storeId: storeId,
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
    * quantityAdjustment: positive or negative number indicating the change
    * transactionType: one of 'adjustmentIn', 'adjustmentOut', 'purchaseReceive'
    * notes: optional reason for adjustment
 */
export const adjustStock = async (req: CustomRequest, res: Response) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store to adjust inventory.",
                StatusCodes.FORBIDDEN,
            );
        }

        const { id: menuItemId } = req.params;

        const { quantityAdjustment, transactionType, notes } = req.body; // quantityAdjustment is the delta (+ or -)
        const userId = currentUser?.id;

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
            storeId,
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
        const minStockLevel = currentInventory.minStockLevel; // Retrieve minStockLevel

        if (newQuantity < 0) {
            return handleError2(
                res,
                "Cannot adjust stock to a negative quantity. Check your current stock and adjustment amount.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const newStatus = calculateInventoryStatus(newQuantity, minStockLevel);

        // Update the Inventory table and log the Transaction (within a transaction block for safety)
        const updatedInventory = await db.transaction(async (tx) => {

            //  Update the Inventory record
            const [updated] = await tx
                .update(inventory)
                .set({
                    quantity: newQuantity,
                    lastModified: new Date(),
                    lastCountDate: new Date(),
                    // TODO: (Future) Add logic here to update 'status' based on 'newQuantity' vs 'minStockLevel'
                    status: newStatus,
                })
                .where(
                    and(
                        eq(inventory.menuItemId, menuItemId),
                        eq(inventory.storeId, storeId),
                    ),
                )
                .returning();

            // Insert the Inventory Transaction record
            await tx
                .insert(inventoryTransactions)
                .values({
                    menuItemId,
                    storeId,
                    transactionType,
                    quantityChange: changeAmount,
                    resultingQuantity: newQuantity,
                    performedBy: userId,
                    notes: notes,
                    transactionDate: new Date(),
                })
                .returning({ id: inventoryTransactions.id });

            return updated;
        });

        // 5. Log activity
        await logActivity({
            userId: userId,
            storeId: storeId,
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

/**
 * @desc    [INTERNAL] Decrement stock levels for all items in a completed order.
 * @route   (Internal API call - no external route needed, or use a POST route without user authentication)
 * @access  Internal (Called by Order Controller)
 * @body    { orderId: string, items: OrderItemStockUpdate[], performedBy: string, storeId: string }
 */
export const decrementStockForOrder = async (
    orderId: string,
    items: OrderItemStockUpdate[],
    performedBy: string,
    storeId: string,
    tx: NodePgDatabase<any>
) => {
    try {

        if (!items || items.length === 0) {
            return; // No items to process
        }

        // Fetch current inventory for all relevant items
        const menuItemIds = items.map((item) => item.menuItemId);

        // Fetch current inventory records using the TRANSACTION object (tx), NOT db
        // This ensures the stock check is part of the overall Order creation unit of work.
        const currentInventoryRecords = await tx
            .select()
            .from(inventory)
            .where(
                and(
                    eq(inventory.storeId, storeId),
                    inArray(inventory.menuItemId, menuItemIds),
                ),
            );

        const inventoryMap = new Map(
            currentInventoryRecords.map((item) => [item.menuItemId, item]),
        );

        // Pre-check: Ensure all items exist and have enough inventories (stocks)
        for (const item of items) {
            const currentRecord = inventoryMap.get(item.menuItemId);

            if (!currentRecord) {
                // If the inventory record is missing, throw an error and roll back the Order.
                throw new Error(
                    `Inventory record not found for menu item ID: ${item.menuItemId}`,
                );
            }
            if (currentRecord.quantity < item.quantity) {
                // Insufficient stock, throw an error and roll back the Order.
                throw new Error(
                    `Insufficient stock for item ID: ${item.menuItemId}. Current: ${currentRecord.quantity}, Ordered: ${item.quantity}.`,
                );
            }
        }

        // Perform atomic update: Update inventory and log transactions for all items
        // REMOVE the nested db.transaction block and use the passed `tx` object
        for (const item of items) {
            const currentRecord = inventoryMap.get(item.menuItemId)!;
            const changeAmount = -item.quantity;
            const newQuantity = currentRecord.quantity + changeAmount;
            const minStockLevel = currentRecord.minStockLevel;

            // Calculate the new status (using the helper function you planned)
            const newStatus = calculateInventoryStatus(
                newQuantity,
                minStockLevel,
            );

            // Update Inventory record using the transaction object (tx)
            await tx
                .update(inventory)
                .set({
                    quantity: newQuantity,
                    lastModified: new Date(),
                    lastCountDate: new Date(),
                    status: newStatus,
                })
                .where(
                    and(
                        eq(inventory.menuItemId, item.menuItemId),
                        eq(inventory.storeId, storeId),
                    ),
                );

            // Insert Inventory Transaction record using the transaction object (tx)
            await tx.insert(inventoryTransactions).values({
                menuItemId: item.menuItemId,
                storeId: storeId,
                transactionType: "sale",
                quantityChange: changeAmount,
                resultingQuantity: newQuantity,
                performedBy: performedBy,
                notes: `Sale via Order ID: ${orderId}`,
                sourceDocumentId: orderId,
                transactionDate: new Date(),
            });
        }

        return true; // Success indicator
    } catch (error) {
        // Log the error but re-throw it so the calling controller can roll back the order creation/update
        console.error("Error decrementing stock for order:", error);
        throw error;
    }
};

/**
 * @desc    Mark an inventory record as 'discontinued'.
 * @route   PATCH /api/v1/inventory/discontinue/:menuItemId
 * @access  Private (Manager/Admin only)
 */
export const markAsDiscontinued = async (
    req: CustomRequest,
    res: Response,
) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store.",
                StatusCodes.FORBIDDEN,
            );
        }

        // Authorisation check (You may need helper middleware for this in a real app)
        // if (currentUser.role !== 'MANAGER' && currentUser.role !== 'ADMIN') {
        //     return handleError2(res, "Only managers or admins can discontinue inventory.", StatusCodes.FORBIDDEN);
        // }

        const { id: menuItemId } = req.params;
        const { id: userId} = currentUser;
        // const userId = currentUser?.id;

        const [updatedInventory] = await db
            .update(inventory)
            .set({
                status: "discontinued", // Set to the desired status
                lastModified: new Date(),
            })
            .where(
                and(
                    eq(inventory.menuItemId, menuItemId),
                    eq(inventory.storeId, storeId),
                    // Prevent discontinuing if already discontinued
                    ne(inventory.status, "discontinued"),
                ),
            )
            .returning();

        if (!updatedInventory) {
            return handleError2(
                res,
                "Inventory record not found or already discontinued.",
                StatusCodes.NOT_FOUND,
            );
        }

        // Log activity
        await logActivity({
            userId: userId,
            storeId: storeId,
            action: "INVENTORY_DISCONTINUED",
            entityId: updatedInventory.id,
            entityType: "inventory",
            details: `Inventory for Menu Item ${menuItemId} marked as discontinued.`,
        });

        res.status(StatusCodes.OK).json(updatedInventory);
    } catch (error) {
        handleError2(
            res,
            "Problem marking inventory as discontinued, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Completely delete an inventory record for a menu item.
 * @route   DELETE /api/v1/inventory/:menuItemId
 * @access  Private (Admin/Highly Restricted)
 */
export const deleteInventoryRecord = async (
    req: CustomRequest,
    res: Response,
) => {
    try {
        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        if (!storeId) {
            return handleError2(
                res,
                "You must be associated with a store.",
                StatusCodes.FORBIDDEN,
            );
        }

        const { id: menuItemId } = req.params;
        const { id: userId} = currentUser;
        // const userId = currentUser?.id;

        // Fetch the record before deleting to get the Inventory ID for logging
        const inventoryToDelete = await getInventoryByMenuItemId(
            menuItemId,
            storeId,
        );

        if (!inventoryToDelete) {
            return handleError2(
                res,
                "Inventory record not found.",
                StatusCodes.NOT_FOUND,
            );
        }

        // The 'onDelete: cascade' on `inventory.menuItemId` in the schema
        // will automatically clean up the `inventory` record if the `menuItem` is deleted.
        // If we only delete the `inventory` record, we must manually delete transactions.

        // Since `inventory` references `menuItems` (cascade is set on the inventory side),
        // we assume deleting the `inventory` record is the intent here.
        // We will manually delete the transactions within a transaction for safety.

        await db.transaction(async (tx) => {
            // Delete all associated transactions first (if not cascading from the inventory table)
            // If `inventoryTransactions` does NOT cascade delete on `inventory.menuItemId` deletion, this step is needed:
            await tx
                .delete(inventoryTransactions)
                .where(
                    and(
                        eq(inventoryTransactions.menuItemId, menuItemId),
                        eq(inventoryTransactions.storeId, storeId),
                    ),
                );

            // Delete the inventory record itself
            await tx
                .delete(inventory)
                .where(
                    and(
                        eq(inventory.menuItemId, menuItemId),
                        eq(inventory.storeId, storeId),
                    ),
                )
                .returning();
        });


        // Log activity
        await logActivity({
            userId: userId,
            storeId: storeId,
            action: "INVENTORY_RECORD_DELETED",
            entityId: inventoryToDelete.id, // Use the ID of the deleted inventory record
            entityType: "inventory",
            details: `Inventory record for Menu Item ${menuItemId} deleted permanently.`,
        });

        res.status(StatusCodes.OK).json({
            message: "Inventory record and all associated transactions deleted successfully.",
        });
    } catch (error) {
        handleError2(
            res,
            "Problem deleting inventory record, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};