import {
    doublePrecision,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { stores } from "../stores-schema";
import { users } from "../users-schema";
import { rawMaterials } from "./index"; // Assuming a users table for audit trails

// Enum for the type of stock movement
export const rawMaterialTransactionTypeEnum = pgEnum(
    "rawMaterialTransactionType",
    [
        "comingIn", // Stock Addition (e.g. Receipt from PO, Adjustment IN)
        "goingOut", // Stock Deduction (e.g. Usage in Recipe, Wastage/Loss, Adjustment OUT)
    ],
);

// Enum for the source/reason of the transaction
export const rawMaterialTransactionSourceEnum = pgEnum(
    "rawMaterialTransactionSource",
    [
        "purchaseReceipt", // Stock added via Purchase Order
        "productionUsage", // Stock deducted for use in a recipe/product
        "inventoryAdjustment", // Manual correction (IN or OUT)
        "wastage", // Deduction due to spoilage or loss
        "transferIn",
        "transferOut",
    ],
);

export const rawMaterialStockTransactions = pgTable(
    "rawMaterialStockTransactions",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        rawMaterialId: uuid("rawMaterialId")
            .notNull()
            .references(() => rawMaterials.id, { onDelete: "restrict" }),
        storeId: uuid("storeId")
            .notNull()
            .references(() => stores.id, { onDelete: "restrict" }),
        userId: uuid("userId")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),

        type: rawMaterialTransactionTypeEnum("type").notNull(),
        source: rawMaterialTransactionSourceEnum("source").notNull(),

        // Quantity is always stored in the Base Unit (g, ml, or piece)
        quantityBase: doublePrecision("quantityBase").notNull(),

        // Reference to an external document ID (e.g. Purchase Order ID, Production Batch ID)
        documentRefId: uuid("documentRefId"),

        notes: text("notes"),

        createdAt: timestamp("createdAt").defaultNow().notNull(),
        lastModified: timestamp("lastModified")
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
);

export type RawMaterialStockTransactionSchemaT =
    typeof rawMaterialStockTransactions.$inferSelect;
export type InsertRawMaterialStockTransactionSchemaT =
    typeof rawMaterialStockTransactions.$inferInsert;
export type RawMaterialTransactionType =
    (typeof rawMaterialTransactionTypeEnum.enumValues)[number];
export type RawMaterialTransactionSource =
    (typeof rawMaterialTransactionSourceEnum.enumValues)[number];
