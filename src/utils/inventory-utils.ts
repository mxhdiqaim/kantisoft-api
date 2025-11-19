// Define the exact string literal types for incoming transaction types
export type TransactionType =
    | "sale"
    | "purchaseReceive"
    | "adjustmentIn"
    | "adjustmentOut"
    | "transferOut"
    | "transferIn";

// Define the exact string literal types for the resulting log actions
export type StockAdjustedAction =
    | "STOCK_ADJUSTED_SALE"
    | "STOCK_ADJUSTED_PURCHASE_RECEIVE"
    | "STOCK_ADJUSTED_ADJUSTMENT_IN"
    | "STOCK_ADJUSTED_ADJUSTMENT_OUT"
    | "STOCK_ADJUSTED_TRANSFER_OUT"
    | "STOCK_ADJUSTED_TRANSFER_IN";

// Lookup Map for mapping TransactionType to StockAdjustedAction
const actionMap: Record<TransactionType, StockAdjustedAction> = {
    sale: "STOCK_ADJUSTED_SALE",
    purchaseReceive: "STOCK_ADJUSTED_PURCHASE_RECEIVE",
    adjustmentIn: "STOCK_ADJUSTED_ADJUSTMENT_IN",
    adjustmentOut: "STOCK_ADJUSTED_ADJUSTMENT_OUT",
    transferOut: "STOCK_ADJUSTED_TRANSFER_OUT",
    transferIn: "STOCK_ADJUSTED_TRANSFER_IN",
};

/**
 * Maps a specific inventory transaction type to a standardised stock adjustment action log string.
 *
 * @param transactionType The transaction type from the database (e.g. "sale").
 * @returns The corresponding standardised action string (e.g., "STOCK_ADJUSTED_SALE").
 * @throws Error if the transactionType is not a recognised type.
 */
export const getStockAdjustedAction = (
    transactionType: TransactionType,
): StockAdjustedAction => actionMap[transactionType];
