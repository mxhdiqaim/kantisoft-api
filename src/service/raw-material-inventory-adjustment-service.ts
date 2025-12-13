import db from "../db";
import { rawMaterialInventory } from "../schema/raw-materials-schema/raw-material-inventory-schema";
import {
    InsertRawMaterialStockTransactionSchemaT,
    rawMaterialStockTransactions,
} from "../schema/raw-materials-schema/raw-material-stock-transaction-schema";
import { UnitConversionService } from "./unit-conversion-service";
import { and, eq, sql } from "drizzle-orm";
import { calculateInventoryStatus } from "../helpers";

/**
 * Service to handle all atomic inventory adjustments (IN or OUT).
 */
export const InventoryAdjustmentService = {
    /**
     * Executes an atomic inventory update, logging the transaction and updating the inventory Master record.
     * @param transaction The raw transaction data from the controller.
     * @param quantityPresentation The quantity the user entered (e.g. 10 kg).
     * @param unitOfMeasurementId The ID of the unit used in the transaction.
     * @returns The updated raw material inventory record.
     */
    async processStockAdjustment(
        transaction: Omit<
            InsertRawMaterialStockTransactionSchemaT,
            "quantityBase" | "createdAt" | "id" | "lastModified"
        >,
        quantityPresentation: number,
        unitOfMeasurementId: string,
    ) {
        // Fetch Unit and Calculate Base Quantity
        const unitRecord =
            await UnitConversionService.fetchUnitById(unitOfMeasurementId);

        if (!unitRecord) {
            throw new Error(`Unit of measurement not found.`);
        }

        // Convert the user's quantity (e.g. 10 kg) into the Base Unit (e.g. 10,000 g)
        const quantityBase = UnitConversionService.convertToBaseUnit(
            quantityPresentation,
            unitRecord,
        );

        // Determine Sign for Update
        // Inventory transactions are signed: '+' for 'in', '-' for 'out'.
        const quantityChange =
            transaction.type === "comingIn" ? quantityBase : -quantityBase;

        // Start Atomic Transaction (Drizzle Transaction)
        return db.transaction(async (tx) => {
            // a. Record the Stock Transaction (Ledger Entry)
            await tx
                .insert(rawMaterialStockTransactions)
                .values({
                    ...transaction,
                    quantityBase: quantityBase, // Always positive in the log, the 'type' field indicates direction
                })
                .returning();

            // b. Atomically Update the Inventory Master Record
            const [updatedRecord] = await tx
                .update(rawMaterialInventory)
                .set({
                    quantity: sql`${rawMaterialInventory.quantity}
                    +
                    ${quantityChange}`, // Add or Subtract the Base Unit quantity
                    lastModified: new Date(),
                })
                .where(
                    and(
                        eq(
                            rawMaterialInventory.rawMaterialId,
                            transaction.rawMaterialId,
                        ),
                        eq(rawMaterialInventory.storeId, transaction.storeId),
                    ),
                )
                .returning();

            if (!updatedRecord) {
                // Check if the inventory record exists before attempting update
                throw new Error(
                    "Raw Material Inventory record does not exist in this store.",
                );
            }

            // c. Re-determine and Update Inventory Status (Low Stock/Out of Stock)
            // const updatedRecord = inventoryUpdate[0];
            const newQuantity = updatedRecord.quantity;
            const minStockLevel = updatedRecord.minStockLevel;

            const newStatus = calculateInventoryStatus(
                newQuantity,
                minStockLevel,
            );

            if (newStatus !== updatedRecord.status) {
                // Perform a final update to set the new status
                await tx
                    .update(rawMaterialInventory)
                    .set({ status: newStatus })
                    .where(eq(rawMaterialInventory.id, updatedRecord.id));

                updatedRecord.status = newStatus; // Update the returned object
            }

            return updatedRecord; // Return the final, updated inventory record
        });
    },
};
