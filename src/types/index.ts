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
