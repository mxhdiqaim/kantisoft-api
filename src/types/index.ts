import {
    INVENTORY_TRANSACTION_SUMMARY_TYPES,
    INVENTORY_TRANSACTION_TYPES,
} from "./enums";

export type Period = "today" | "week" | "month" | "all-time";

export type TimePeriod = "today" | "week" | "month";

export type DateInput = string | Date | undefined | null;

export type OrderBy = "quantity" | "revenue";

export type OrderItemStockUpdate = {
    menuItemId: string;
    quantity: number; // The quantity sold (positive number)
    priceAtOrder: number; // Optional, but good for context
};

export interface FilterDates {
    startDate: Date | undefined;
    endDate: Date | undefined;
    // Indicates which logic block was used to determine the dates
    periodUsed: TimePeriod | "custom" | "all-time";
}

export type StoreQueryType =
    | "Main Store"
    | "Targeted Store"
    | "All Stores (Aggregated)";

export interface ValidatedStoreDatesType {
    storeIds: string[];
    finalStartDate?: Date;
    finalEndDate?: Date;
    periodUsed: TimePeriod | "custom" | "all-time";
    storeQueryType: StoreQueryType;
    // queriedStoreIds: string[];
}

export interface UpdateInventoryBody {
    quantity?: number;
    inventoryStatus?: typeof INVENTORY_TRANSACTION_TYPES;
    lastCountDate?: Date;
    transactionType?: typeof INVENTORY_TRANSACTION_SUMMARY_TYPES;
}
