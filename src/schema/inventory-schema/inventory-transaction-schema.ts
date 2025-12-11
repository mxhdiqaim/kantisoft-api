import {
    doublePrecision,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { menuItems } from "../menu-items-schema";
import { stores } from "../stores-schema";
import { users } from "../users-schema";
import { rawMaterials } from "../raw-materials-schema";

// Transaction types define why the inventory quantity changed
export const transactionTypeEnum = pgEnum("transactionType", [
    "sale", // Quantity decreased due to a customer order (linked to orderItems table)
    "purchaseReceive", // Quantity increased due to a delivery/purchase order
    "adjustmentIn", // Manual increase (e.g. finding misplaced stock)
    "adjustmentOut", // Manual decrease (e.g. waste, spoilage, theft)
    "transferOut", // Moving stock to another store/location (not currently implemented TODO: will be implemented later)
    "transferIn", // Receiving stock from another store/location (not currently implemented TODO: will be implemented later)
]);

// Transactions table: Logs every movement (in/out) of inventory
export const inventoryTransactions = pgTable("inventoryTransactions", {
    id: uuid("id").defaultRandom().primaryKey(),

    menuItemId: uuid("menuItemId")
        .notNull()
        .references(() => menuItems.id),
    rawMaterialId: uuid("rawMaterialId").references(() => rawMaterials.id),
    storeId: uuid("storeId")
        .notNull()
        .references(() => stores.id),

    // Core Transaction Fields
    transactionType: transactionTypeEnum("transactionType")
        .notNull()
        .default("sale"),
    quantityChange: doublePrecision("quantityChange").notNull(), // The amount moved (+ or -)
    resultingQuantity: doublePrecision("resultingQuantity"), // The stock level AFTER this transaction

    // Reference Fields (for tracking the source of the change)
    sourceDocumentId: uuid("sourceDocumentId"), // e.g., Order ID for 'sale', or PO ID for 'purchase_receive'
    // This column will reference the primary key of the relevant source document (orders, orderItems, purchaseOrders, etc.)

    // Auditing
    performedBy: uuid("performedBy").references(() => users.id), // Who performed the change (staff, manager)
    notes: text("notes"), // reason for adjustment/transfer
    transactionDate: timestamp("transactionDate").defaultNow().notNull(),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryTransactionSchemaT =
    typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransactionSchemaT =
    typeof inventoryTransactions.$inferInsert;
